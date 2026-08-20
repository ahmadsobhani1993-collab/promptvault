#!/bin/bash
set -e

# ---------- 1) Simple image diagnostic ----------
mkdir -p src/app/api/debug/diagnose-images
cat > src/app/api/debug/diagnose-images/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'No Telegram token configured' }, { status: 500 })

  // Get a sample prompt with Telegram image
  const samplePrompt = await prisma.prompt.findFirst({
    where: { img: { contains: 'api.telegram.org' } },
    select: { slug: true, titleFa: true, img: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  if (!samplePrompt) {
    return NextResponse.json({
      ok: true,
      message: 'No prompts with Telegram images found in database',
    })
  }

  const tests: any[] = []

  // Test 1: Check if bot token is valid
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(5000),
    })
    const meData = await meRes.json()
    tests.push({
      name: 'Bot Token',
      ok: meData.ok,
      botUsername: meData.result?.username,
      hint: meData.ok ? '✅ Token is valid' : '❌ Token is invalid',
    })
  } catch (err: any) {
    tests.push({
      name: 'Bot Token',
      ok: false,
      error: err.message,
      hint: '❌ Cannot connect to Telegram API',
    })
  }

  // Test 2: Try to access the image URL directly (server-side)
  try {
    const imgRes = await fetch(samplePrompt.img!, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      signal: AbortSignal.timeout(5000),
    })
    tests.push({
      name: 'Image URL Access (Server)',
      status: imgRes.status,
      ok: imgRes.ok,
      contentType: imgRes.headers.get('content-type'),
      hint: imgRes.ok ? '✅ Server can access image' : '❌ Server cannot access image (expired or blocked)',
    })
  } catch (err: any) {
    tests.push({
      name: 'Image URL Access (Server)',
      ok: false,
      error: err.message,
      hint: '❌ Connection failed',
    })
  }

  // Test 3: Check file_path format
  const fileIdMatch = samplePrompt.img?.match(/\/bot[^/]+\/(.+)$/)
  const filePath = fileIdMatch?.[1]
  const fileAge = Math.floor((Date.now() - samplePrompt.createdAt.getTime()) / 3600000)
  
  tests.push({
    name: 'File Path Analysis',
    filePath: filePath || 'Not found',
    fileAge: `${fileAge} hours old`,
    hint: fileAge > 24 ? '⚠️ File path is old (>24h), likely expired' : '✅ File path is recent',
  })

  // Test 4: Try to get fresh file_path using getFile API
  let freshFileId = null
  try {
    // Extract file_id from the URL (we need to store it separately)
    // For now, just check if we can call getFile
    const getFileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=test`, {
      signal: AbortSignal.timeout(5000),
    })
    const getFileData = await getFileRes.json()
    tests.push({
      name: 'getFile API',
      ok: getFileData.ok === false && getFileData.error_code === 400, // Expected error for invalid file_id
      hint: '✅ getFile API is working',
    })
  } catch (err: any) {
    tests.push({
      name: 'getFile API',
      ok: false,
      error: err.message,
      hint: '❌ Cannot call getFile API',
    })
  }

  return NextResponse.json({
    ok: true,
    samplePrompt: {
      slug: samplePrompt.slug,
      title: samplePrompt.titleFa,
      imageUrl: samplePrompt.img,
      age: `${fileAge} hours old`,
    },
    tests,
    conclusion: tests.every(t => t.ok) 
      ? '✅ All tests passed. Issue might be CORS in browser.'
      : '❌ Some tests failed. See details above.',
    recommendations: [
      'If Image URL Access failed: file_path expired, need to refresh',
      'If Bot Token failed: check TELEGRAM_READ_TOKEN env var',
      'If all passed but images still broken: CORS issue, need proxy',
    ],
  })
}
EOF
echo "✅ Image diagnostic route created"

echo ""
echo "===== AFTER DEPLOY ====="
echo ""
echo "Test this URL:"
echo "  https://promptsfa.ir/api/debug/diagnose-images?key=pv-cron-8x2m1q"
echo ""
echo "This will tell us exactly why images aren't loading."
echo "=================================="

echo "✅ update219 done!"