import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })

  const channelUsername = process.env.TELEGRAM_CHANNEL || 'promptsfa1'

  try {
    // Get channel info
    const chatRes = await fetch(
      `https://api.telegram.org/bot${token}/getChat?chat_id=@${channelUsername}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const chatResult = await chatRes.json()
    
    if (!chatResult.ok) {
      return NextResponse.json({
        ok: false,
        error: chatResult.description,
        hint: 'Make sure bot is admin in channel @' + channelUsername
      })
    }

    const chat = chatResult.result
    const channelId = chat.id

    // Save to settings
    await prisma.setting.upsert({
      where: { key: 'tg_channel_chat_id' },
      update: { value: String(channelId) },
      create: { key: 'tg_channel_chat_id', value: String(channelId) },
    })

    return NextResponse.json({
      ok: true,
      channel: {
        id: channelId,
        username: chat.username,
        title: chat.title,
        type: chat.type,
      },
      saved: true,
      hint: 'Channel ID saved. Bot must be admin to upload.',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
