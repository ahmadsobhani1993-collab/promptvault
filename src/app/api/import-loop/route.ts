import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeWithGemini } from '@/lib/gemini'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'
const TARGET_CHANNEL = '@promptsfa1'
const MAX_PHOTOS_PER_RUN = 10
const MAX_CONSECUTIVE_FAILURES = 10

async function getSetting(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}

async function setSetting(k: string, v: string) {
  await prisma.setting.upsert({ 
    where: { key: k }, 
    update: { value: v }, 
    create: { key: k, value: v } 
  })
}

// استخراج پرامپت از JSON یا متن ساده
function extractPromptFromText(text: string): { prompt: string, title?: string, desc?: string } {
  try {
    // اگر JSON بود
    if (text.trim().startsWith('{')) {
      const json = JSON.parse(text)
      
      // ساختارهای مختلف JSON را چک کن
      if (json.prompt) return { prompt: json.prompt, title: json.title, desc: json.description }
      if (json.text) return { prompt: json.text, title: json.title, desc: json.description }
      if (json.content) return { prompt: json.content, title: json.title, desc: json.description }
      
      // ساختار تو در تو
      if (json.description?.prompt) return { prompt: json.description.prompt }
      if (json.data?.prompt) return { prompt: json.data.prompt }
      
      // اگر هیچکدام نبود، کل JSON را stringify کن
      return { prompt: JSON.stringify(json, null, 2) }
    }
  } catch (e) {
    // اگر JSON نبود، متن ساده را برگردان
  }
  
  return { prompt: text }
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 })
  
  const api = (method: string, params?: Record<string, string>) =>
    `https://api.telegram.org/bot${token}/${method}${params ? '?' + new URLSearchParams(params).toString() : ''}`

  const debug: string[] = []
  const results: any[] = []
  
  // ریست کردن کانال به @promptsfa1
  const chatRes = await fetch(api('getChat', { chat_id: TARGET_CHANNEL }))
  const chatData = await chatRes.json()
  if (!chatData.ok) {
    return NextResponse.json({ error: 'Bot must be admin in ' + TARGET_CHANNEL, details: chatData.description }, { status: 400 })
  }
  const chatId = String(chatData.result.id)
  await setSetting('tg_chat_id', chatId)

  let privChat = await getSetting('tg_private_chat', '')
  if (!privChat) {
    return NextResponse.json({ error: 'Please send /start to the bot in private chat first.' }, { status: 400 })
  }

  let cursor = parseInt(await getSetting('import_cursor_msg_id', '2'), 10)
  let consecutiveFailures = parseInt(await getSetting('import_failures', '0'), 10)
  let successCount = 0
  let currentRetry = 0

  const categories = await prisma.category.findMany()
  debug.push(`🚀 Starting import from ${TARGET_CHANNEL} (ID: ${chatId}), cursor: ${cursor}`)

  while (successCount < MAX_PHOTOS_PER_RUN && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
    debug.push(`\n--- Checking Message ID: ${cursor} ---`)

    // Forward پیام جاری (عکس)
    const fwdRes = await fetch(api('forwardMessage', { chat_id: privChat, from_chat_id: chatId, message_id: String(cursor) }))
    const fwdData = await fwdRes.json()

    if (!fwdData.ok) {
      debug.push(`❌ Forward failed: ${fwdData.description}`)
      consecutiveFailures++
      currentRetry++
      if (currentRetry >= MAX_CONSECUTIVE_FAILURES) break
      cursor++
      continue
    }

    consecutiveFailures = 0
    currentRetry = 0
    const msg = fwdData.result
    const fwdMsgId = msg.message_id
    const msgsToDelete: number[] = [fwdMsgId]

    // بررسی اینکه آیا این پیام عکس دارد
    if (!msg.photo) {
      debug.push(`️ Skip: Not a photo`)
      await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(fwdMsgId) })).catch(() => {})
      cursor++
      continue
    }

    // بررسی کپشن - اگر کپشن فقط راهنما بود، نادیده بگیر
    const caption = (msg.caption || '').trim()
    const isPlaceholderCaption = /new prompt|پرامپت جدید|prompt in the next message|پرامپت در پیام بعد/i.test(caption)
    
    let promptText = ''
    let promptMsgId = cursor

    // اگر کپشن معتبر بود (نه راهنما)
    if (caption && !isPlaceholderCaption && caption.length > 30) {
      promptText = caption
      debug.push(`✅ Using caption from message ${cursor}`)
    } else {
      // جستجوی پرامپت در پیام بعدی (ریپلای)
      debug.push(`🔍 Caption is placeholder or short. Checking next message (${cursor + 1})...`)
      
      const nextRes = await fetch(api('forwardMessage', { chat_id: privChat, from_chat_id: chatId, message_id: String(cursor + 1) }))
      const nextData = await nextRes.json()
      
      if (nextData.ok) {
        const nextMsg = nextData.result
        msgsToDelete.push(nextMsg.message_id)
        
        const nextText = (nextMsg.text || nextMsg.caption || '').trim()
        
        // بررسی اینکه آیا پیام بعدی ریپلای به این عکس است
        const isReply = nextMsg.reply_to_message?.message_id === cursor
        
        if (isReply && nextText.length > 50) {
          promptText = nextText
          promptMsgId = cursor + 1
          debug.push(`✅ Found reply text in message ${cursor + 1} (length: ${nextText.length})`)
        } else if (nextText.length > 100) {
          // حتی اگر ریپلای رسمی نبود، اگر متن طولانی بود
          promptText = nextText
          promptMsgId = cursor + 1
          debug.push(`✅ Found long text in message ${cursor + 1} (length: ${nextText.length})`)
        }
      }
    }

    if (!promptText) {
      debug.push(`⏭️ Skip: No valid prompt text found`)
      for (const id of msgsToDelete) {
        await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(id) })).catch(() => {})
      }
      cursor++
      continue
    }

    // استخراج پرامپت از JSON یا متن
    const extracted = extractPromptFromText(promptText)
    const finalPrompt = extracted.prompt

    // گرفتن لینک عکس
    const fileId = msg.photo[msg.photo.length - 1].file_id
    const fileRes = await fetch(api('getFile', { file_id: fileId }))
    const fileData = await fileRes.json()

    for (const id of msgsToDelete) {
      await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(id) })).catch(() => {})
    }

    if (!fileData.ok || !fileData.result?.file_path) {
      debug.push(`❌ Skip: Could not get file_path`)
      cursor = promptMsgId + 1
      continue
    }

    // ساخت لینک پراکسی به جای لینک مستقیم تلگرام
    const telegramUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`
    const proxyUrl = `${APP_URL}/api/image-proxy?url=${encodeURIComponent(telegramUrl)}`

    debug.push(`🖼️ Using proxy URL: ${proxyUrl.substring(0, 60)}...`)

    // ارسال به جمینای (فقط متن)
    try {
      debug.push(`🤖 Sending to Gemini...`)
      const ai = await analyzeWithGemini({ text: finalPrompt, categories })
      
      const cat = await prisma.category.findUnique({ where: { slug: ai.categorySlug } })

      // چک کردن تکراری بودن
      const existing = await prisma.prompt.findUnique({ where: { slug: `tg-${cursor}` } })
      if (existing) {
        debug.push(`⏭️ Skip: Already exists (tg-${cursor})`)
        cursor = promptMsgId + 1
        continue
      }

      await prisma.prompt.create({
        data: {
          titleFa: ai.titleFa || extracted.title || 'پرامپت جدید',
          titleEn: ai.titleEn || extracted.title || 'New Prompt',
          descFa: ai.descFa || extracted.desc || '',
          descEn: ai.descEn || extracted.desc || '',
          usageFa: ai.usageFa || '',
          usageEn: ai.usageEn || '',
          slug: `tg-${cursor}`,
          img: proxyUrl, // استفاده از لینک پراکسی
          model: /--v\s?\d|--ar|midjourney/i.test(finalPrompt) ? 'Midjourney' : 'AI',
          type: 'IMAGE',
          status: 'PUBLISHED',
          categoryId: cat?.id ?? categories[0]?.id,
          tagsFa: ai.tagsFa,
          tagsEn: ai.tagsEn,
          prompt: finalPrompt,
          views: 1 + Math.floor(Math.random() * 10),
        },
      })

      results.push({ id: cursor, slug: `tg-${cursor}`, title: ai.titleFa })
      successCount++
      debug.push(`✅ Successfully imported: ${ai.titleFa}`)
      
      cursor = promptMsgId + 1

    } catch (e: any) {
      const errMsg = String(e?.message ?? e)
      debug.push(`❌ Error for ID ${cursor}: ${errMsg}`)
      currentRetry++
      if (currentRetry >= MAX_CONSECUTIVE_FAILURES) {
        cursor = promptMsgId + 1
        currentRetry = 0
      }
    }
  }

  await setSetting('import_cursor_msg_id', String(cursor))
  await setSetting('import_failures', String(consecutiveFailures))

  return NextResponse.json({ ok: true, summary: { processed_up_to: cursor, success_count: successCount }, results, debug })
}
