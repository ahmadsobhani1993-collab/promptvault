import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 30

async function getSetting(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const q = new URL(req.url).searchParams
  const start = parseInt(q.get('start') || '799')
  const count = Math.min(20, parseInt(q.get('count') || '10', 10))

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })
  const api = (m: string, p?: Record<string, string>) =>
    `https://api.telegram.org/bot${token}/${m}${p ? '?' + new URLSearchParams(p) : ''}`

  const chatId = await getSetting('tg_channel_chat_id', '')
  const privChat = await getSetting('tg_private_chat', '')

  const results: any[] = []

  for (let msgId = start; msgId < start + count; msgId++) {
    const f = await (await fetch(api('forwardMessage', {
      chat_id: privChat, from_chat_id: chatId, message_id: String(msgId)
    }))).json()

    if (!f.ok) {
      results.push({ msgId, status: 'not_found', error: f.description?.slice(0, 80) })
      continue
    }

    const msg = f.result
    const info: any = {
      msgId,
      type: msg.photo ? 'photo' : msg.video ? 'video' : msg.text ? 'text' : 'other',
      hasPhoto: !!msg.photo,
      hasVideo: !!msg.video,
      captionLen: (msg.caption || '').length,
      captionPreview: (msg.caption || '').slice(0, 100),
    }

    // پاک کردن forwarded message
    await fetch(api('deleteMessage', {
      chat_id: privChat, message_id: String(msg.message_id)
    })).catch(() => {})

    results.push(info)
  }

  return NextResponse.json({
    ok: true,
    range: `${start}-${start + count - 1}`,
    results,
    summary: {
      photo: results.filter(r => r.hasPhoto).length,
      video: results.filter(r => r.hasVideo).length,
      not_found: results.filter(r => r.status === 'not_found').length,
      other: results.filter(r => !r.hasPhoto && !r.hasVideo && r.status !== 'not_found').length,
    }
  })
}
