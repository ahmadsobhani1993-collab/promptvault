import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const channel = process.env.TELEGRAM_CHANNEL
  const res = await fetch('https://t.me/s/' + channel, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    signal: AbortSignal.timeout(9000),
  })
  const html = await res.text()
  const idx = html.indexOf('tgme_widget_message')

  return NextResponse.json({
    status: res.status,
    len: html.length,
    snippet: html.slice(Math.max(0, idx - 300), idx + 3500),
  })
}
