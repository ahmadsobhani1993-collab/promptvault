#!/bin/bash
set -e

# ---------- 1) Better network monitor: count API calls ----------
mkdir -p src/app/api/debug/network-monitor-v2
cat > src/app/api/debug/network-monitor-v2/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || 'status'

  if (action === 'reset') {
    // Reset counters
    await prisma.setting.upsert({
      where: { key: 'api_calls_count' },
      update: { value: '0' },
      create: { key: 'api_calls_count', value: '0' },
    })
    await prisma.setting.upsert({
      where: { key: 'api_calls_bytes' },
      update: { value: '0' },
      create: { key: 'api_calls_bytes', value: '0' },
    })
    return NextResponse.json({ ok: true, message: 'Counters reset' })
  }

  if (action === 'report') {
    const calls = parseInt((await prisma.setting.findUnique({ where: { key: 'api_calls_count' } }))?.value || '0')
    const bytes = parseInt((await prisma.setting.findUnique({ where: { key: 'api_calls_bytes' } }))?.value || '0')
    
    return NextResponse.json({
      ok: true,
      apiCalls: calls,
      estimatedBytes: bytes,
      estimatedMB: (bytes / 1024 / 1024).toFixed(3),
      hint: 'این آمار از زمان آخرین reset جمع‌آوری شده است',
    })
  }

  // Default status
  const calls = parseInt((await prisma.setting.findUnique({ where: { key: 'api_calls_count' } }))?.value || '0')
  const bytes = parseInt((await prisma.setting.findUnique({ where: { key: 'api_calls_bytes' } }))?.value || '0')
  
  return NextResponse.json({
    ok: true,
    current: {
      apiCalls: calls,
      estimatedBytes: bytes,
      estimatedMB: (bytes / 1024 / 1024).toFixed(3),
    },
    instructions: {
      reset: '?action=reset - Reset counters before test',
      import: 'Run import-loop once',
      report: '?action=report - See how much data was used',
    },
  })
}
EOF
echo "✅ Network monitor v2: counts API calls"

# ---------- 2) Update import-loop to track API calls ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/import-loop/route.ts'
let s = fs.readFileSync(p, 'utf8')

// Add API call tracking function
if (!s.includes('async function trackApiCall')) {
  const trackingFunc = `
async function trackApiCall(bytes: number) {
  try {
    const currentCalls = parseInt((await prisma.setting.findUnique({ where: { key: 'api_calls_count' } }))?.value || '0')
    const currentBytes = parseInt((await prisma.setting.findUnique({ where: { key: 'api_calls_bytes' } }))?.value || '0')
    await prisma.setting.upsert({
      where: { key: 'api_calls_count' },
      update: { value: String(currentCalls + 1) },
      create: { key: 'api_calls_count', value: String(currentCalls + 1) },
    })
    await prisma.setting.upsert({
      where: { key: 'api_calls_bytes' },
      update: { value: String(currentBytes + bytes) },
      create: { key: 'api_calls_bytes', value: String(currentBytes + bytes) },
    })
  } catch (err) {
    // Silently fail
  }
}
`
  s = s.replace('export async function GET', trackingFunc + '\nexport async function GET')
  console.log('✅ Added trackApiCall function')
}

// Add tracking after each API call
if (!s.includes('trackApiCall(500)')) {
  // After forwardMessage
  s = s.replace(
    /const f1 = await \(await fetch\(api\('forwardMessage'/g,
    `await trackApiCall(500) // forwardMessage
    const f1 = await (await fetch(api('forwardMessage'`
  )
  
  // After getFile
  s = s.replace(
    /const fr = await \(await fetch\(api\('getFile'/g,
    `await trackApiCall(200) // getFile
    const fr = await (await fetch(api('getFile'`
  )
  
  // After download image (big one!)
  s = s.replace(
    /const ir = await fetch\('https:\/\/api\.telegram\.org\/file\/bot'/g,
    `await trackApiCall(500000) // download image (~500KB)
    const ir = await fetch('https://api.telegram.org/file/bot'`
  )
  
  // After Gemini call
  s = s.replace(
    /ai = await analyzeWithGemini/g,
    `await trackApiCall(1000000) // Gemini API (~1MB)
    ai = await analyzeWithGemini`
  )
  
  console.log('✅ Added tracking after API calls')
}

fs.writeFileSync(p, s)
NODEEOF

echo ""
echo "===== HOW TO TEST ====="
echo "Step 1: Reset counters"
echo "  https://promptsfa.ir/api/debug/network-monitor-v2?key=pv-cron-8x2m1q&action=reset"
echo ""
echo "Step 2: Run import-loop ONCE"
echo "  https://promptsfa.ir/api/import-loop?key=pv-cron-8x2m1q&count=1"
echo ""
echo "Step 3: Check usage"
echo "  https://promptsfa.ir/api/debug/network-monitor-v2?key=pv-cron-8x2m1q&action=report"
echo ""
echo "This will show EXACTLY how many API calls and bytes were used!"
echo "======================================"

echo "✅ update202 done!"