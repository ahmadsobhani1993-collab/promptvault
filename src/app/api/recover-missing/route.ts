import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeWithGemini } from '@/lib/gemini'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 120
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'

async function getSetting(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
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

  const { searchParams } = new URL(req.url)
  const start = parseInt(searchParams.get('start') || '2', 10)
  const end = parseInt(searchParams.get('end') || '50', 10)
  
  const chatId = await getSetting('tg_chat_id', '')
  const privChat = await getSetting('tg_private_chat', '')
  
  if (!chatId || !privChat) {
    return NextResponse.json({ error: 'Settings not configured' }, { status: 400 })
  }

  const categories = await prisma.category.findMany()
  const debug: any[] = []
  const results: any[] = []
  const skipped: any[] = []

  for (let msgId = start; msgId <= end; msgId++) {
    try {
      // چک کردن اینکه آیا قبلاً ایمپورت شده
      const existing = await prisma.prompt.findUnique({ where: { slug: `tg-${msgId}` } })
      if (existing) {
        skipped.push({ msgId, reason: 'already_exists' })
        continue
      }

      // Forward پیام
      const fwdRes = await fetch(api('forwardMessage', { 
        chat_id: privChat,
        from_chat_id: chatId, 
        message_id: String(msgId) 
      }))
      
      if (!fwdRes.ok) {
        skipped.push({ msgId, reason: 'cannot_forward' })
        continue
      }
      
      const fwdData = await fwdRes.json()
      if (!fwdData.ok) {
        skipped.push({ msgId, reason: 'forward_failed' })
        continue
      }

      const msg = fwdData.result
      const fwdMsgId = msg.message_id

      // بررسی عکس
      if (!msg.photo) {
        skipped.push({ msgId, reason: 'not_a_photo' })
        await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(fwdMsgId) })).catch(() => {})
        continue
      }

      const caption = (msg.caption || '').trim()
      let promptText = ''

      // حالت 1: کپشن معتبر
      if (caption.length > 50) {
        promptText = caption
        debug.push({ msgId, status: 'valid_caption', length: caption.length })
      } else {
        // حالت 2: بررسی پیام بعدی (ریپلای)
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
            const nextText = (nextMsg.text || nextMsg.caption || '').trim()
            
            if (nextText.length > 50 && !nextMsg.photo) {
              promptText = nextText
              debug.push({ msgId, status: 'found_in_next_message', nextMsgId, length: nextText.length })
            }
            
            await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(nextMsg.message_id) })).catch(() => {})
          }
        }
      }

      await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(fwdMsgId) })).catch(() => {})

      if (!promptText) {
        skipped.push({ msgId, reason: 'no_valid_prompt' })
        continue
      }

      // گرفتن لینک عکس
      const fileId = msg.photo[msg.photo.length - 1].file_id
      const fileRes = await fetch(api('getFile', { file_id: fileId }))
      const fileData = await fileRes.json()
      
      if (!fileData.ok || !fileData.result?.file_path) {
        skipped.push({ msgId, reason: 'no_file_path' })
        continue
      }

      const telegramUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`
      const proxyUrl = `${APP_URL}/api/image-proxy?url=${encodeURIComponent(telegramUrl)}`

      // پردازش با جمینای
      const finalPrompt = extractPrompt(promptText)
      
      try {
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
        debug.push({ msgId, status: 'imported', title: ai.titleFa })

      } catch (geminiError: any) {
        const errMsg = String(geminiError?.message ?? geminiError)
        skipped.push({ msgId, reason: 'gemini_error', error: errMsg })
      }

    } catch (e: any) {
      skipped.push({ msgId, reason: 'error', error: e.message })
    }
  }

  return NextResponse.json({
    range: { start, end },
    summary: {
      total: end - start + 1,
      imported: results.length,
      skipped: skipped.length,
    },
    results,
    skipped,
    debug,
  })
}
