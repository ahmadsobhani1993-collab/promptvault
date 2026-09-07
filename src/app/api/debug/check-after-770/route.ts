import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const q = new URL(req.url).searchParams
  const start = parseInt(q.get('start') || '771', 10)
  const count = Math.min(100, parseInt(q.get('count') || '80', 10))

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })
  const api = (m: string, p?: Record<string, string>) =>
    `https://api.telegram.org/bot${token}/${m}${p ? '?' + new URLSearchParams(p) : ''}`

  const chatId = (await prisma.setting.findUnique({ where: { key: 'tg_channel_chat_id' } }))?.value
  const privChat = (await prisma.setting.findUnique({ where: { key: 'tg_private_chat' } }))?.value
  if (!chatId || !privChat) return NextResponse.json({ error: 'missing chat IDs' }, { status: 500 })

  const results: any[] = []

  for (let msgId = start; msgId < start + count; msgId++) {
    const slug = 'tg-' + msgId

    // 1. چک کن آیا در سایت (DB) وجود دارد
    const inDb = await prisma.prompt.findUnique({ where: { slug } })

    // 2. چک کن آیا در تلگرام وجود دارد
    const f = await (await fetch(api('forwardMessage', {
      chat_id: privChat, from_chat_id: chatId, message_id: String(msgId)
    }))).json()

    let inTelegram = false
    let tgType = null
    if (f.ok && f.result) {
      inTelegram = true
      tgType = f.result.photo ? 'photo' : f.result.video ? 'video' : f.result.text ? 'text' : 'other'
      // پاک کردن forwarded message
      await fetch(api('deleteMessage', {
        chat_id: privChat, message_id: String(f.result.message_id)
      })).catch(() => {})
    }

    results.push({
      msgId,
      inDb: !!inDb,
      dbStatus: inDb?.status || null,
      inTelegram,
      tgType,
      problem: inDb && !inTelegram ? '⚠️ در سایت هست ولی در تلگرام نیست' :
               !inDb && inTelegram ? '✅ در تلگرام هست ولی در سایت نیست (باید ایمپورت شود)' :
               inDb && inTelegram ? '✓ هر دو' : '— هیچ‌کدام',
    })
  }

  const inDbOnly = results.filter(r => r.inDb && !r.inTelegram)
  const inTgOnly = results.filter(r => !r.inDb && r.inTelegram)
  const inBoth = results.filter(r => r.inDb && r.inTelegram)
  const inNone = results.filter(r => !r.inDb && !r.inTelegram)

  return NextResponse.json({
    ok: true,
    range: `${start}-${start + count - 1}`,
    summary: {
      in_db_only: inDbOnly.length,
      in_telegram_only: inTgOnly.length,
      in_both: inBoth.length,
      in_none: inNone.length,
    },
    diagnosis: inTgOnly.length > 0
      ? `✅ ${inTgOnly.length} پست در تلگرام هست ولی ایمپورت نشده — مشکل از collect است (gap یا threshold)`
      : inDbOnly.length > 0
      ? `⚠️ ${inDbOnly.length} پست در سایت هست ولی در تلگرام نیست — لینک تکراری/اشتباه`
      : 'همه پست‌ها sync هستند',
    telegram_only: inTgOnly.slice(0, 10),
    db_only: inDbOnly.slice(0, 10),
  })
}
