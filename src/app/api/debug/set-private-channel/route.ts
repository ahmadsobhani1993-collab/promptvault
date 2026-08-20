import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const channelId = searchParams.get('id') // e.g., -1001234567890

  if (!channelId || !channelId.startsWith('-100')) {
    return NextResponse.json({ 
      error: 'Invalid ID', 
      hint: 'Please provide a valid numeric channel ID starting with -100 (e.g., ?id=-1001234567890)' 
    }, { status: 400 })
  }

  await prisma.setting.upsert({
    where: { key: 'tg_chat_id' },
    update: { value: channelId },
    create: { key: 'tg_chat_id', value: channelId },
  })

  return NextResponse.json({
    ok: true,
    message: `Channel ID ${channelId} saved successfully. Import loop will now use this private channel.`,
  })
}
