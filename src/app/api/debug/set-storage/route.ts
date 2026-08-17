import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })

  const source = (await prisma.setting.findUnique({ where: { key: 'tg_chat_id' } }))?.value ?? ''
  const ur = await (await fetch('https://api.telegram.org/bot' + token + '/getUpdates?limit=100', { signal: AbortSignal.timeout(10000) })).json()

  for (const u of ur.result ?? []) {
    const chat = u.channel_post?.chat
    if (chat && chat.type === 'channel' && String(chat.id) !== source) {
      await prisma.setting.upsert({
        where: { key: 'tg_storage_chat' },
        update: { value: String(chat.id) },
        create: { key: 'tg_storage_chat', value: String(chat.id) },
      })
      return NextResponse.json({ ok: true, storage: String(chat.id), title: chat.title })
    }
  }
  return NextResponse.json({ ok: false, hint: 'یک پیام در کانال انبار بفرست (بات ادمین باشد) و دوباره بزن' })
}
