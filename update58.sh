#!/bin/bash
set -e

cat > src/app/api/debug/telegram-test/route.ts << 'EOF'
import { NextResponse } from 'next/server'

async function dl(url: string, headers: Record<string, string>) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(10000), redirect: 'follow' })
    const buf = Buffer.from(await r.arrayBuffer())
    const isJpeg = buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8
    return { status: r.status, size: buf.length, type: r.headers.get('content-type'), isJpeg }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function GET() {
  const channel = 'Prompts_fa'

  // list page
  const listHtml = await (await fetch('https://t.me/s/' + channel, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    signal: AbortSignal.timeout(8000),
  })).text()

  const idm = listHtml.match(/data-post="[^"]*\/(\d+)"/)
  const postId = idm ? idm[1] : '3639'
  const imgM = listHtml.match(/background-image:url\('([^']+)'\)/)
  const listImg = imgM ? (imgM[1].startsWith('//') ? 'https:' + imgM[1] : imgM[1]) : null

  // single post page
  let singleImg: string | null = null
  let singleHtmlLen = 0
  try {
    const singleHtml = await (await fetch('https://t.me/' + channel + '/' + postId, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(8000),
    })).text()
    singleHtmlLen = singleHtml.length
    const m2 = singleHtml.match(/background-image:url\('([^']+)'\)/)
    if (m2) singleImg = m2[1].startsWith('//') ? 'https:' + m2[1] : m2[1]
    // also look for any bigger photo link
    const m3 = singleHtml.match(/url\('(https:\/\/cdn[^']+\.jpg)'\)/)
    if (m3 && !singleImg) singleImg = m3[1]
  } catch {}

  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  }

  const results: any = { postId, listImg: listImg?.slice(0, 80), singleImg: singleImg?.slice(0, 80), singleHtmlLen }

  if (listImg) {
    results.listPlain = await dl(listImg, { 'User-Agent': 'Mozilla/5.0' })
    results.listWithReferer = await dl(listImg, { ...browserHeaders, Referer: 'https://t.me/' })
  }
  if (singleImg && singleImg !== listImg) {
    results.singlePlain = await dl(singleImg, { 'User-Agent': 'Mozilla/5.0' })
    results.singleWithReferer = await dl(singleImg, { ...browserHeaders, Referer: 'https://t.me/' })
  } else if (singleImg) {
    results.singleSameAsList = true
  }

  return NextResponse.json(results)
}
EOF

echo "✅ debug v3!"