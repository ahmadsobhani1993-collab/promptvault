#!/bin/bash
set -e

cat > src/app/api/debug/telegram-test/route.ts << 'EOF'
import { NextResponse } from 'next/server'

function decode(html: string): string {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .trim()
}

export async function GET() {
  const channel = 'Prompts_fa'
  const directUrl = 'https://t.me/s/' + channel

  // 1) fetch direct
  let html = ''
  let fetchOk = false
  let fetchError = ''
  try {
    const r = await fetch(directUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(8000),
    })
    html = await r.text()
    fetchOk = r.ok
  } catch (e: any) {
    fetchError = e.message
  }

  if (!html) {
    return NextResponse.json({ fetch: { ok: fetchOk, error: fetchError }, messages: 0 })
  }

  // 2) parse messages
  const parts = html.split('<div class="tgme_widget_message_wrap')
  const messages: any[] = []
  for (const p of parts.slice(1)) {
    const idm = p.match(/data-post="[^"]*\/(\d+)"/)
    if (!idm) continue
    const textM = p.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)
    const imgM = p.match(/background-image:url\('([^']+)'\)/)
    let img: string | null = null
    if (imgM) img = imgM[1].startsWith('//') ? 'https:' + imgM[1] : imgM[1]
    const text = textM ? decode(textM[1]) : ''
    messages.push({
      id: parseInt(idm[1], 10),
      hasText: text.length > 0,
      textLen: text.length,
      hasImg: !!img,
      img: img ? img.slice(0, 120) + (img.length > 120 ? '...' : '') : null,
      fullImg: img,
    })
  }

  // 3) try downloading the first image
  const firstImg = messages.find((m) => m.fullImg)?.fullImg
  let dl: { ok: boolean; type?: string; size?: number; error?: string } = { ok: false }
  if (firstImg) {
    try {
      const r = await fetch(firstImg, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      })
      const type = r.headers.get('content-type') ?? ''
      const buf = await r.arrayBuffer()
      dl = { ok: r.ok && type.startsWith('image/'), type, size: buf.byteLength }
    } catch (e: any) {
      dl = { ok: false, error: e.message }
    }
  }

  // 4) also try wsrv.nl proxy on first image
  let dlProxy: { ok: boolean; type?: string; size?: number; error?: string } = { ok: false }
  if (firstImg) {
    try {
      const proxyUrl = 'https://wsrv.nl/?url=' + encodeURIComponent(firstImg) + '&output=jpg'
      const r = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(12000),
      })
      const type = r.headers.get('content-type') ?? ''
      const buf = await r.arrayBuffer()
      dlProxy = { ok: r.ok && type.startsWith('image/'), type, size: buf.byteLength }
    } catch (e: any) {
      dlProxy = { ok: false, error: e.message }
    }
  }

  return NextResponse.json({
    fetch: { ok: fetchOk, error: fetchError, bytes: html.length },
    totalMessages: messages.length,
    withImg: messages.filter((m) => m.hasImg).length,
    withText: messages.filter((m) => m.hasText).length,
    firstImage: firstImg ?? null,
    downloadDirect: dl,
    downloadViaWsrv: dlProxy,
    sampleMessages: messages.slice(0, 5).map(({ fullImg, ...rest }) => rest),
  })
}
EOF

echo "✅ telegram-test upgraded!"