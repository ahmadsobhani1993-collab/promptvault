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

  const api = (m: string, p?: Record<string, string>) =>
    `https://api.telegram.org/bot${token}/${m}${p ? '?' + new URLSearchParams(p).toString() : ''}`

  const chatId = await getSetting('tg_chat_id', '')
  const privChat = await getSetting('tg_private_chat', '')
  if (!chatId || !privChat) {
    return NextResponse.json({ error: 'Settings not configured' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const startMsg = parseInt(searchParams.get('start') || '4', 10)
  const lookAhead = parseInt(searchParams.get('lookahead') || '10', 10)

  const results: any[] = []

  for (let i = 0; i < 5; i++) {
    const msgId = startMsg + i
    const log: any = { msgId, hasPhoto: false, textFound: false }

    // Forward عکس
    const fwdRes = await fetch(api('forwardMessage', {
      chat_id: privChat,
      from_chat_id: chatId,
      message_id: String(msgId)
    }))
    const fwdData = await fwdRes.json()
    if (!fwdData.ok) {
      log.error = fwdData.description
      results.push(log)
      continue
    }

    const msg = fwdData.result
    log.hasPhoto = !!msg.photo
    log.hasCaption = !!msg.caption

    if (!msg.photo) {
      log.skip = 'not a photo'
      await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(msg.message_id) })).catch(() => {})
      results.push(log)
      continue
    }

    // جستجوی متن در پیام‌های بعدی
    let foundText = ''
    let foundAtOffset = 0
    const fwdIdsToDelete: number[] = [msg.message_id]

    for (let offset = 1; offset <= lookAhead; offset++) {
      const nextRes = await fetch(api('forwardMessage', {
        chat_id: privChat,
        from_chat_id: chatId,
        message_id: String(msgId + offset)
      }))
      const nextData = await nextRes.json()
      
      if (!nextData.ok) break
      
      const nextMsg = nextData.result
      fwdIdsToDelete.push(nextMsg.message_id)
      
      const nextText = (nextMsg.text || nextMsg.caption || '').trim()
      
      // اگر ریپلای به عکس ما بود
      if (nextMsg.reply_to_message?.message_id === msgId && nextText.length > 20) {
        foundText = nextText
        foundAtOffset = offset
        break
      }
      
      // اگر متن طولانی بود (حتی بدون ریپلای)
      if (nextText.length > 50 && !nextMsg.photo) {
        foundText = nextText
        foundAtOffset = offset
        break
      }
    }

    log.textFound = !!foundText
    log.foundAtOffset = foundAtOffset
    log.textPreview = foundText.substring(0, 100)
    log.textLength = foundText.length

    // پاک کردن همه پیام‌های forward شده
    for (const fid of fwdIdsToDelete) {
      await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(fid) })).catch(() => {})
    }

    results.push(log)
  }

  return NextResponse.json({ ok: true, results })
}
