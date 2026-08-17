#!/bin/bash
set -e

cat > src/app/api/debug/telegram-test/route.ts << 'EOF'
import { NextResponse } from 'next/server'

export async function GET() {
  const tests: { name: string; url: string; ok: boolean; len?: number; error?: string }[] = []

  const channel = 'Prompts_fa'
  const directUrl = 'https://t.me/s/' + channel
  const alloriginsUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(directUrl)
  const codetabsUrl = 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(directUrl)

  // test 1: direct
  try {
    const r = await fetch(directUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(8000),
    })
    const text = await r.text()
    tests.push({ name: 'direct', url: directUrl, ok: r.ok, len: text.length })
  } catch (e: any) {
    tests.push({ name: 'direct', url: directUrl, ok: false, error: e.message })
  }

  // test 2: allorigins
  try {
    const r = await fetch(alloriginsUrl, { signal: AbortSignal.timeout(10000) })
    const text = await r.text()
    tests.push({ name: 'allorigins', url: alloriginsUrl, ok: r.ok, len: text.length })
  } catch (e: any) {
    tests.push({ name: 'allorigins', url: alloriginsUrl, ok: false, error: e.message })
  }

  // test 3: codetabs
  try {
    const r = await fetch(codetabsUrl, { signal: AbortSignal.timeout(10000) })
    const text = await r.text()
    tests.push({ name: 'codetabs', url: codetabsUrl, ok: r.ok, len: text.length })
  } catch (e: any) {
    tests.push({ name: 'codetabs', url: codetabsUrl, ok: false, error: e.message })
  }

  // test 4: extract one image URL
  let imgUrl: string | null = null
  try {
    const r = await fetch(alloriginsUrl, { signal: AbortSignal.timeout(10000) })
    const text = await r.text()
    const m = text.match(/background-image:url\('([^']+)'\)/)
    if (m) imgUrl = m[1].startsWith('//') ? 'https:' + m[1] : m[1]
  } catch {}

  // test 5: download that image
  let imgOk = false
  let imgError = ''
  if (imgUrl) {
    try {
      const r = await fetch(imgUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000),
      })
      imgOk = r.ok && (r.headers.get('content-type') ?? '').startsWith('image/')
    } catch (e: any) {
      imgError = e.message
    }
  }

  return NextResponse.json({
    tests,
    firstImageUrl: imgUrl,
    imageDownload: { ok: imgOk, error: imgError },
  })
}
EOF

echo "✅ debug endpoint created!"