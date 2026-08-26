import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeWithGemini } from '@/lib/gemini'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 120
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'
const TARGET_CHANNEL = '@promptsfa1'
const BATCH_SIZE = 5

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

// بررسی اینکه آیا کپشن معتبر است (نه راهنما)
function isValidCaption(caption: string): boolean {
  if (!caption || caption.length < 30) return false
  
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
  
  // دریافت chatId کانال
  let chatId = await getSetting('tg_chat_id', '')
  if (!chatId) {
    const chatRes = await fetch(api('getChat', { chat_id: TARGET_CHANNEL }))
    const chatData = await chatRes.json()
    if (!chatData.ok) return NextResponse.json({ error: 'Bot not admin in channel' }, { status: 400 })
    chatId = String(chatData.result.id)
    await setSetting('tg_chat_id', chatId)
  }

  let privChat = await getSetting('tg_private_chat', '')
  if (!privChat) {
    return NextResponse.json({ error: 'Send /start to bot first' }, { status: 400 })
  }

  let cursor = parseInt(await getSetting('import_cursor_msg_id', '2'), 10)
  const categories = await prisma.category.findMany()
  
  debug.push(`🔍 Scanning for photos with replies from ID ${cursor}`)

  let processed = 0
  let scanned = 0
  const MAX_SCAN = 50 // اسکن حداکثر 50 پیام برای پیدا کردن 5 پرامپت معتبر

  while (processed < BATCH_SIZE && scanned < MAX_SCAN) {
    const currentMsgId = cursor + scanned
    
    try {
      // Forward پیام جاری
      const fwdRes = await fetch(api('forwardMessage', { 
        chat_id: privChat, 
        from_chat_id: chatId, 
        message_id: String(currentMsgId) 
      }))
      const fwdData = await fwdRes.json()
      
      if (!fwdData.ok) {
        debug.push(`️ Skip ${currentMsgId}: ${fwdData.description}`)
        scanned++
        continue
      }

      const msg = fwdData.result
      const fwdMsgId = msg.message_id

      // بررسی اینکه آیا این پیام عکس است
      if (!msg.photo) {
        debug.push(`️ Skip ${currentMsgId}: Not a photo`)
        await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(fwdMsgId) })).catch(() => {})
        scanned++
        continue
      }

      // این یک عکس است! حالا بررسی کنیم
      const caption = (msg.caption || '').trim()
      let promptText = ''
      let promptSourceMsgId = currentMsgId

      // حالت 1: عکس کپشن معتبر دارد
      if (isValidCaption(caption)) {
        promptText = caption
        debug.push(`✅ Photo ${currentMsgId} has valid caption (${caption.length} chars)`)
      } else {
        // حالت 2: عکس کپشن معتبر ندارد، باید به دنبال پیام‌های ریپلای بگردیم
        debug.push(`🔍 Photo ${currentMsgId} has invalid/short caption. Searching for replies...`)
        
        // جستجو در پیام‌های بعدی برای پیدا کردن ریپلای به این عکس
        for (let offset = 1; offset <= 10; offset++) {
          const nextMsgId = currentMsgId + offset
          
          const nextFwdRes = await fetch(api('forwardMessage', { 
            chat_id: privChat, 
            from_chat_id: chatId, 
            message_id: String(nextMsgId) 
          }))
          const nextFwdData = await nextFwdRes.json()
          
          if (!nextFwdData.ok) break
          
          const nextMsg = nextFwdData.result
          const nextFwdId = nextMsg.message_id
          
          // بررسی اینکه آیا این پیام به عکس ما ریپلای شده است
          if (nextMsg.reply_to_message?.message_id === currentMsgId) {
            const replyText = (nextMsg.text || nextMsg.caption || '').trim()
            if (replyText.length > 50) {
              promptText = replyText
              promptSourceMsgId = nextMsgId
              debug.push(`✅ Found REPLY at message ${nextMsgId} (${replyText.length} chars)`)
              await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(nextFwdId) })).catch(() => {})
              break
            }
          }
          
          // اگر به عکس ما ریپلای نشده، پاکش کن و ادامه بده
          await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(nextFwdId) })).catch(() => {})
        }
      }

      // پاک کردن پیام فوروارد شده عکس
      await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(fwdMsgId) })).catch(() => {})

      if (!promptText) {
        debug.push(`⏭️ Skip ${currentMsgId}: No valid prompt found (caption or reply)`)
        scanned++
        continue
      }

      // گرفتن لینک عکس
      const fileId = msg.photo[msg.photo.length - 1].file_id
      const fileRes = await fetch(api('getFile', { file_id: fileId }))
      const fileData = await fileRes.json()
      
      if (!fileData.ok || !fileData.result?.file_path) {
        debug.push(`❌ Skip ${currentMsgId}: No file_path`)
        cursor = promptSourceMsgId + 1
        scanned = cursor - (parseInt(await getSetting('import_cursor_msg_id', '2'), 10))
        continue
      }

      const telegramUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`
      const proxyUrl = `${APP_URL}/api/image-proxy?url=${encodeURIComponent(telegramUrl)}`

      // پردازش با جمینای
      const finalPrompt = extractPrompt(promptText)
      
      // چک کردن تکراری نبودن
      const existing = await prisma.prompt.findUnique({ where: { slug: `tg-${currentMsgId}` } })
      if (existing) {
        debug.push(`️ Skip ${currentMsgId}: Already exists`)
        cursor = promptSourceMsgId + 1
        scanned = cursor - (parseInt(await getSetting('import_cursor_msg_id', '2'), 10))
        continue
      }

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
          slug: `tg-${currentMsgId}`,
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

      results.push({ id: currentMsgId, slug: `tg-${currentMsgId}`, title: ai.titleFa })
      processed++
      debug.push(`✅ Imported ${currentMsgId}: ${ai.titleFa}`)
      
      cursor = promptSourceMsgId + 1
      scanned = cursor - (parseInt(await getSetting('import_cursor_msg_id', '2'), 10))

    } catch (e: any) {
      debug.push(`❌ Error at ${currentMsgId}: ${e.message}`)
      scanned++
    }
  }

  await setSetting('import_cursor_msg_id', String(cursor))

  return NextResponse.json({ 
    ok: true, 
    summary: { 
      processed: results.length, 
      next_cursor: cursor,
      scanned_messages: scanned 
    },
    results, 
    debug 
  })
}
