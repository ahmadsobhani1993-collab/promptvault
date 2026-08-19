import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })

  // Hardcode the correct channel
  const channelUsername = 'promptsfa1'

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

    // Save to settings with specific key
    await prisma.setting.upsert({
      where: { key: 'tg_upload_channel' },
      update: { value: String(channelId) },
      create: { key: 'tg_upload_channel', value: String(channelId) },
    })

    // Also update TELEGRAM_CHANNEL env usage
    await prisma.setting.upsert({
      where: { key: 'TELEGRAM_CHANNEL' },
      update: { value: channelUsername },
      create: { key: 'TELEGRAM_CHANNEL', value: channelUsername },
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
      message: 'Channel @promptsfa1 saved successfully',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
