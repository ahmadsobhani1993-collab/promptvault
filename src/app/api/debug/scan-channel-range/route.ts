import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 500 })

  const api = (m: string, q?: Record<string, string>) =>
    'https://api.telegram.org/bot' + token + '/' + m + (q ? '?' + new URLSearchParams(q).toString() : '')

  const chatId = await (await prisma.setting.findUnique({ where: { key: 'tg_chat_id' } }))?.value
  if (!chatId) {
    return NextResponse.json({ error: 'tg_chat_id not set' }, { status: 500 })
  }

  try {
    // Get channel info to find message count
    const chatRes = await fetch(api('getChat', { chat_id: chatId }), {
      signal: AbortSignal.timeout(10000),
    })
    const chatData = await chatRes.json()

    if (!chatData.ok) {
      return NextResponse.json({
        ok: false,
        error: chatData.description,
        hint: 'ربات باید ادمین کانال باشد',
      })
    }

    const channel = chatData.result
    
    // Try to get last message by forwarding message 999999 (will fail but tell us the max)
    // For now, just return channel info
    return NextResponse.json({
      ok: true,
      channel: {
        id: channel.id,
        title: channel.title,
        type: channel.type,
        username: channel.username,
      },
      info: {
        lastMessageId: '1884 (based on your observation)',
        estimatedPrompts: '~1000-1500 (some messages are not prompts)',
      },
      recommendation: {
        startFrom: 1,
        stopAt: 1900,
        estimatedNetworkMB: '3.8 MB (1900 messages × 2KB)',
      },
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
