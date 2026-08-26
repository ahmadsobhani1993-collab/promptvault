import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeWithGemini } from '@/lib/gemini'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 120
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'
const TARGET_CHANNEL = '@promptsfa1'

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

function extractPrompt(text: string): string {
  try {
    if (text.trim().startsWith('{')) {
      const json = JSON.parse(text)
      return json.prompt || json.text || json.content || JSON.stringify(json)
    }
  } catch (e) {}
  return text
}

function isValidCaption(caption: string): boolean {
  if (!caption || caption.length < 50) return false
  
  const placeholderPatterns = [
    /new prompt/i,
    /پرامپت جدید/i,
    /prompt in the next message/i,
    /پرامپت در پیام بعد/i,
    /see next message/i,
    /در پیام بعد/i,
    /👇/
  ]
  
  return !placeholderPatterns.some(pattern => pattern.test(caption))
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 500 })
  
  const api = (method: string, params?: Record<string, string>) =>
    `https://api.telegram.org/bot${token}/${method}${params ? '?' + new URLSearchParams(params).toString() : ''}`

  const debug: string[] = []
  const results: any[] = []
  
  let chatId = await getSetting('tg_chat_id', '')
  if (!chatId) {
    const chatRes = await fetch(api('getChat', { chat_id: TARGET_CHANNEL }))
    const chatData = await chatRes.json()
    if (!chatData.ok) return NextResponse.json({ error: 'Bot not admin' }, { status: 400 })
    chatId = String(chatData.result.id)
    await setSetting('tg_chat_id', chatId)
  }

  let privChat = await getSetting('tg_private_chat', '')
  if (!privChat) {
    return NextResponse.json({ error: 'Send /start to bot first' }, { status: 400 })
  }

  let cursor = parseInt(await getSetting('import_cursor_msg_id', '2'), 10)
  const categories = await prisma.category.findMany()
  
  debug.push(`🔍 Starting from message ID ${cursor} (target: 10 prompts)`)

  let imported = 0
  const MAX_MESSAGES = 50

  for (let offset = 0; offset < MAX_MESSAGES && imported < 10; offset++) {
    const msgId = cursor + offset
    
    try {
      // Forward پیام جاری
      const fwdRes = await fetch(api('forwardMessage', { 
        chat_id: privChat,
        from_chat_id: chatId, 
        message_id: String(msgId) 
      }))
      
      if (!fwdRes.ok) {
        debug.push(`⏭️ ${msgId}: Cannot forward`)
        continue
      }
      
      const fwdData = await fwdRes.json()
      if (!fwdData.ok) continue
      
      const msg = fwdData.result
      const fwdMsgId = msg.message_id

      // اگر عکس نیست، رد شو
      if (!msg.photo) {
        debug.push(`⏭️ ${msgId}: Not a photo (skipping)`)
        await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(fwdMsgId) })).catch(() => {})
        continue
      }

      // این یک عکس است! بررسی کپشن
      const caption = (msg.caption || '').trim()
      let promptText = ''
      let skipNext = false

      // حالت 1: کپشن معتبر (طولانی و بدون کلمات راهنما)
      if (isValidCaption(caption)) {
        promptText = caption
        debug.push(`✅ ${msgId}: Valid caption (${caption.length} chars)`)
      } else {
        // حالت 2: کپشن کوتاه/نامعتبر → بررسی پیام بعدی
        debug.push(`🔍 ${msgId}: Short caption (${caption.length} chars). Checking next message...`)
        
        const nextMsgId = msgId + 1
        const nextFwdRes = await fetch(api('forwardMessage', { 
          chat_id: privChat,
          from_chat_id: chatId, 
          message_id: String(nextMsgId) 
        }))
        
        if (nextFwdRes.ok) {
          const nextFwdData = await nextFwdRes.json()
          if (nextFwdData.ok) {
            const nextMsg = nextFwdData.result
            const nextFwdMsgId = nextMsg.message_id
            const nextText = (nextMsg.text || nextMsg.caption || '').trim()
            
            // اگر پیام بعدی متن طولانی داشت و عکس نداشت
            if (nextText.length > 100 && !nextMsg.photo) {
              promptText = nextText
              skipNext = true // پیام بعدی را رد کن
              debug.push(`✅ ${msgId}: Found prompt in next message ${nextMsgId} (${nextText.length} chars)`)
            } else {
              debug.push(`⏭️ ${msgId}: Next message not suitable (textLen=${nextText.length}, hasPhoto=${!!nextMsg.photo})`)
            }
            
            // پاک کردن پیام بعدی
            await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(nextFwdMsgId) })).catch(() => {})
          }
        }
      }

      // پاک کردن پیام عکس
      await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(fwdMsgId) })).catch(() => {})

      if (!promptText) {
        debug.push(`⏭️ ${msgId}: No valid prompt found`)
        continue
      }

      // گرفتن لینک عکس
      const fileId = msg.photo[msg.photo.length - 1].file_id
      const fileRes = await fetch(api('getFile', { file_id: fileId }))
      const fileData = await fileRes.json()
      
      if (!fileData.ok || !fileData.result?.file_path) {
        debug.push(`❌ ${msgId}: No file_path`)
        continue
      }

      const telegramUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`
      const proxyUrl = `${APP_URL}/api/image-proxy?url=${encodeURIComponent(telegramUrl)}`

      // چک تکراری
      const existing = await prisma.prompt.findUnique({ where: { slug: `tg-${msgId}` } })
      if (existing) {
        debug.push(`⏭️ ${msgId}: Already exists`)
        offset++ // اگر skipNext بود، یک بار دیگر هم رد کن
        continue
      }

      // پردازش با جمینای
      const finalPrompt = extractPrompt(promptText)
      const ai = await analyzeWithGemini({ text: finalPrompt, categories })
      const cat = await prisma.category.findUnique({ where: { slug: ai.categorySlug } })

      await prisma.prompt.create({
        data: {
          titleFa: ai.titleFa,
          titleEn: ai.titleEn,
          descFa: ai.descFa,
          descEn: ai.descEn,
          usageFa: ai.usageFa,
          usageEn: ai.usageEn,
          slug: `tg-${msgId}`,
          img: proxyUrl,
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

      results.push({ id: msgId, slug: `tg-${msgId}`, title: ai.titleFa })
      imported++
      debug.push(`✅ Imported ${msgId}: ${ai.titleFa} (${imported}/10)`)
      
      cursor = msgId + 1
      if (skipNext) {
        offset++ // رد کردن پیام متنی
        cursor = msgId + 2
      }

    } catch (e: any) {
      debug.push(`❌ ${msgId}: ${e.message}`)
    }
  }

  await setSetting('import_cursor_msg_id', String(cursor))

  return NextResponse.json({ 
    ok: true, 
    summary: { imported, next_cursor: cursor, target: 10 },
    results, 
    debug 
  })
}
