import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function decode(s: string) {
  return s
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim()
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const channel = process.env.TELEGRAM_CHANNEL
  const res = await fetch('https://t.me/s/' + channel, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(9000),
  })
  const html = await res.text()

  const parts = html.split('<div class="tgme_widget_message_wrap')
  const messages: any[] = []

  for (const part of parts.slice(1, 6)) {
    const idMatch = part.match(/data-post="[^"]*\/(\d+)"/)
    if (!idMatch) continue

    const textMatch = part.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)
    const imgMatch = part.match(/background-image:url\('([^']+)'\)/)

    messages.push({
      id: idMatch[1],
      hasText: !!textMatch,
      textLen: textMatch ? textMatch[1].length : 0,
      textPreview: textMatch ? decode(textMatch[1]).slice(0, 100) : null,
      hasImg: !!imgMatch,
      img: imgMatch ? imgMatch[1] : null,
    })
  }

  return NextResponse.json({ messages })
}
