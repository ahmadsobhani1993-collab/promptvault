import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

async function getSetting(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 500 })
  
  const api = (method: string, params?: Record<string, string>) =>
    `https://api.telegram.org/bot${token}/${method}${params ? '?' + new URLSearchParams(params).toString() : ''}`

  const chatId = await getSetting('tg_chat_id', '')
  if (!chatId) {
    return NextResponse.json({ error: 'chatId not set' }, { status: 400 })
  }

  const debug: any[] = []
  let hasPhoto = 0
  let alreadyImported = 0
  let noPhoto = 0
  let validForImport = 0

  // دریافت 100 پیام آخر کانال (بدون forward)
  const historyRes = await fetch(api('getChatHistory', { 
    chat_id: chatId,
    limit: '100'
  }))
  
  if (!historyRes.ok) {
    return NextResponse.json({ error: 'Cannot get history' }, { status: 500 })
  }
  
  const historyData = await historyRes.json()
  const messages = historyData.result || []

  for (const msg of messages) {
    const msgId = msg.message_id
    
    if (!msg.photo) {
      noPhoto++
      continue
    }

    hasPhoto++
    
    const caption = (msg.caption || '').trim()
    const existing = await prisma.prompt.findUnique({ where: { slug: `tg-${msgId}` } })
    
    if (existing) {
      alreadyImported++
      continue
    }

    // بررسی پرامپت معتبر
    let hasValidPrompt = false
    if (caption.length > 50) {
      hasValidPrompt = true
    }

    if (hasValidPrompt) {
      validForImport++
      debug.push({ 
        msgId, 
        captionLength: caption.length,
        captionPreview: caption.substring(0, 100)
      })
    }
  }

  return NextResponse.json({
    summary: {
      totalMessages: messages.length,
      hasPhoto,
      alreadyImported,
      noPhoto,
      validForImport,
    },
    readyToImport: debug,
  })
}
