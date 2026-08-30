import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeWithGemini, normalizePrompt } from '@/lib/gemini'
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
  
  debug.push(`🚀 Starting from message ID ${cursor} (target: 10 prompts)`)

  let imported = 0
  const MAX_MESSAGES = 100

  for (let offset = 0; offset < MAX_MESSAGES && imported < 10; offset++) {
    const msgId = cursor + offset
    
    try {
      const fwdRes = await fetch(api('forwardMessage', { 
        chat_id: privChat,
        from_chat_id: chatId, 
        message_id: String(msgId) 
      }))
      
      if (!fwdRes.ok) {
        debug.push(`⚠️ ${msgId}: Cannot forward`)
        cursor = msgId + 1
        continue
      }
      
      const fwdData = await fwdRes.json()
      if (!fwdData.ok) {
        cursor = msgId + 1
        continue
      }
      
      const msg = fwdData.result
      const fwdMsgId = msg.message_id

      if (!msg.photo) {
        debug.push(`⚠️ ${msgId}: Not a photo`)
        await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(fwdMsgId) })).catch(() => {})
        cursor = msgId + 1
        continue
      }

      const caption = (msg.caption || '').trim()
      let promptText = ''

      if (caption.length > 50) {
        promptText = caption
        debug.push(`✅ ${msgId}: Caption is prompt (${caption.length} chars)`)
      } else {
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
            
            if (nextText.length > 50) {
              promptText = nextText
              debug.push(`✅ ${msgId}: Found prompt in next message ${nextMsgId} (${nextText.length} chars)`)
            } else {
              debug.push(`⏭️ ${msgId}: Next message too short (${nextText.length} chars)`)
            }
            
            await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(nextFwdMsgId) })).catch(() => {})
          }
        }
      }

      await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(fwdMsgId) })).catch(() => {})

      if (!promptText) {
        debug.push(`⏭️ ${msgId}: No valid prompt found`)
        cursor = msgId + 1
        continue
      }

      const fileId = msg.photo[msg.photo.length - 1].file_id
      const fileRes = await fetch(api('getFile', { file_id: fileId }))
      const fileData = await fileRes.json()
      
      if (!fileData.ok || !fileData.result?.file_path) {
        debug.push(`❌ ${msgId}: No file_path`)
        cursor = msgId + 1
        continue
      }

      const telegramUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`
      const proxyUrl = `${APP_URL}/api/image-proxy?url=${encodeURIComponent(telegramUrl)}`

      const existing = await prisma.prompt.findUnique({ where: { slug: `tg-${msgId}` } })
      if (existing) {
        debug.push(`⚠️ ${msgId}: Already exists (skipping)`)
        cursor = msgId + 1
        continue
      }

      // مرحله ۱: استخراج خام
      const rawPrompt = extractPrompt(promptText)
      
      // مرحله ۲: تمیزسازی با Gemini (حذف @channel، لینک سایت، حفظ زبان)
      const cleanPrompt = await normalizePrompt(rawPrompt)
      debug.push(`🧹 ${msgId}: Prompt normalized (${cleanPrompt.length} chars)`)

      // مرحله ۳: تحلیل با Gemini برای تولید metadata
      const ai = await analyzeWithGemini({ text: cleanPrompt, categories })
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
          model: /--v\s?\d|--ar|midjourney/i.test(cleanPrompt) ? 'Midjourney' : 'AI',
          type: 'IMAGE',
          status: 'PUBLISHED',
          categoryId: cat?.id ?? categories[0]?.id,
          tagsFa: ai.tagsFa,
          tagsEn: ai.tagsEn,
          prompt: cleanPrompt, // ← پرامپت تمیزشده ذخیره می‌شود
          views: 1 + Math.floor(Math.random() * 10),
        },
      })

      results.push({ id: msgId, slug: `tg-${msgId}`, title: ai.titleFa })
      imported++
      debug.push(`✅ Imported ${msgId}: ${ai.titleFa} (${imported}/10)`)
      
      cursor = msgId + 1

    } catch (e: any) {
      debug.push(`❌ ${msgId}: ${e.message}`)
      cursor = msgId + 1
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
