import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const token = process.env.TELEGRAM_BOT_TOKEN!
  const r = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=@promptsfa1`).then(r => r.json())

  if (!r.ok) return NextResponse.json({ error: r.description })

  const c = r.result
  return NextResponse.json({
    ok: true,
    id: c.id,
    title: c.title,
    type: c.type,
    has_protected_content: c.has_protected_content ?? false,
    permissions: c.permissions,
    note: c.has_protected_content
      ? '⚠️ کانال forwarding را restricted کرده — scraping لازم است'
      : '✅ forwarding مجاز است',
  })
}
