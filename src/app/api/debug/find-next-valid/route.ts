import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startId = parseInt(searchParams.get('start') || '31')
  const maxSearch = parseInt(searchParams.get('max') || '100') // Check up to 100 messages

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 500 })

  const api = (m: string, q?: Record<string, string>) =>
    'https://api.telegram.org/bot' + token + '/' + m + (q ? '?' + new URLSearchParams(q).toString() : '')

  const chatId = await (await prisma.setting.findUnique({ where: { key: 'tg_chat_id' } }))?.value
  const priv = await (await prisma.setting.findUnique({ where: { key: 'tg_private_chat' } }))?.value

  if (!chatId || !priv) return NextResponse.json({ error: 'Chat IDs not set' }, { status: 500 })

  let foundMessage: any = null
  const scanLog: string[] = []

  for (let i = startId; i < startId + maxSearch; i++) {
    // 1. Check if already in DB
    const exists = await prisma.prompt.findUnique({ where: { slug: 'tg-' + i } })
    if (exists) {
      scanLog.push(`[${i}] Skip: Already in DB`)
      continue
    }

    // 2. Try to forward
    const f1 = await (await fetch(api('forwardMessage', { chat_id: priv, from_chat_id: chatId, message_id: String(i) }), { signal: AbortSignal.timeout(5000) })).json()
    if (!f1.ok) {
      scanLog.push(`[${i}] Skip: Forward failed (${f1.description})`)
      continue
    }

    const m1 = f1.result
    const hasPhoto = !!m1.photo?.length
    const text = (m1.caption || m1.text || '').trim
    const hasText = text.length > 20
    const isReply = !!m1.reply_to_message

    // 3. Check if it's a valid prompt (Has photo AND (text OR is a reply to something))
    if (hasPhoto && (hasText || isReply)) {
      foundMessage = {
        messageId: i,
        hasPhoto: true,
        textPreview: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
        isReply: isReply,
        fileId: m1.photo[m1.photo.length - 1].file_id,
      }
      
      // Cleanup forwarded message
      await fetch(api('deleteMessage', { chat_id: priv, message_id: String(m1.message_id) })).catch(() => {})
      break // Stop searching, we found one!
    } else {
      scanLog.push(`[${i}] Skip: No photo or insufficient text`)
      // Cleanup
      await fetch(api('deleteMessage', { chat_id: priv, message_id: String(m1.message_id) })).catch(() => {})
    }
  }

  if (foundMessage) {
    return NextResponse.json({
      ok: true,
      found: true,
      message: foundMessage,
      hint: 'این اولین پیام معتبر و جدید است. حالا می‌توانیم ایمپورت را از اینجا ادامه دهیم.',
      nextStep: `تنظیم cursor روی ${foundMessage.messageId} و اجرای ایمپورت`
    })
  }

  return NextResponse.json({
    ok: true,
    found: false,
    scanLog: scanLog.slice(-20), // Show last 20 checks
    hint: 'در این بازه هیچ پیام جدید و معتبری (عکس+متن) پیدا نشد. یا همه ایمپورت شده‌اند یا کانال خالی است.'
  })
}
