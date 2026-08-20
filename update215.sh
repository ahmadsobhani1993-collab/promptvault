#!/bin/bash
set -e

# ---------- 1) Real-time network monitor with live tracking ----------
mkdir -p src/app/api/debug/realtime-monitor
cat > src/app/api/debug/realtime-monitor/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || 'status'

  if (action === 'start') {
    // Take initial snapshot
    const snapshot = {
      startTime: new Date().toISOString(),
      startCursor: parseInt((await prisma.setting.findUnique({ where: { key: 'import_cursor' } }))?.value || '0'),
      startPrompts: await prisma.prompt.count(),
      startApiCalls: 0,
      estimatedBytes: 0,
    }

    await prisma.setting.upsert({
      where: { key: 'monitor_snapshot' },
      update: { value: JSON.stringify(snapshot) },
      create: { key: 'monitor_snapshot', value: JSON.stringify(snapshot) }
    })

    return NextResponse.json({
      ok: true,
      message: 'Monitoring started',
      snapshot,
    })
  }

  if (action === 'update') {
    const { searchParams } = new URL(req.url)
    const apiCalls = parseInt(searchParams.get('calls') || '1')
    const bytes = parseInt(searchParams.get('bytes') || '500')

    const snapshotStr = (await prisma.setting.findUnique({ where: { key: 'monitor_snapshot' } }))?.value
    if (!snapshotStr) {
      return NextResponse.json({ error: 'No snapshot. Run ?action=start first' }, { status: 400 })
    }

    const snapshot = JSON.parse(snapshotStr)
    snapshot.startApiCalls += apiCalls
    snapshot.estimatedBytes += bytes

    await prisma.setting.upsert({
      where: { key: 'monitor_snapshot' },
      update: { value: JSON.stringify(snapshot) },
      create: { key: 'monitor_snapshot', value: JSON.stringify(snapshot) }
    })

    return NextResponse.json({
      ok: true,
      updated: { apiCalls: snapshot.startApiCalls, bytes: snapshot.estimatedBytes },
    })
  }

  if (action === 'status') {
    const snapshotStr = (await prisma.setting.findUnique({ where: { key: 'monitor_snapshot' } }))?.value
    if (!snapshotStr) {
      return NextResponse.json({ error: 'No active monitoring session' }, { status: 400 })
    }

    const snapshot = JSON.parse(snapshotStr)
    const currentPrompts = await prisma.prompt.count()
    const currentCursor = parseInt((await prisma.setting.findUnique({ where: { key: 'import_cursor' } }))?.value || '0')
    
    const newPrompts = currentPrompts - snapshot.startPrompts
    const elapsed = Date.now() - new Date(snapshot.startTime).getTime()
    const elapsedMinutes = (elapsed / 60000).toFixed(1)

    return NextResponse.json({
      ok: true,
      live: {
        startTime: snapshot.startTime,
        elapsedMinutes: elapsedMinutes + ' min',
        newPromptsImported: newPrompts,
        cursorProgress: `${currentCursor - snapshot.startCursor} messages scanned`,
        apiCalls: snapshot.startApiCalls,
        estimatedBytes: snapshot.estimatedBytes,
        estimatedMB: (snapshot.estimatedBytes / 1024 / 1024).toFixed(3),
        estimatedGB: (snapshot.estimatedBytes / 1024 / 1024 / 1024).toFixed(4),
      },
      neonQuota: {
        remaining: '600 MB',
        percentageUsed: ((snapshot.estimatedBytes / 1024 / 1024 / 600) * 100).toFixed(2) + '%',
      },
      projections: {
        perPrompt: newPrompts > 0 ? (snapshot.estimatedBytes / newPrompts / 1024).toFixed(2) + ' KB' : 'N/A',
        if1000Prompts: ((snapshot.estimatedBytes / (newPrompts || 1)) * 1000 / 1024 / 1024).toFixed(2) + ' MB',
        if2000Prompts: ((snapshot.estimatedBytes / (newPrompts || 1)) * 2000 / 1024 / 1024).toFixed(2) + ' MB',
      },
    })
  }

  if (action === 'reset') {
    await prisma.setting.deleteMany({ where: { key: 'monitor_snapshot' } })
    return NextResponse.json({ ok: true, message: 'Monitor reset' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
EOF
echo "✅ Real-time monitor created"

# ---------- 2) Update import-loop to report to monitor ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/import-loop/route.ts'
let s = fs.readFileSync(p, 'utf8')

// Add monitor reporting at the start
if (!s.includes('reportToMonitor')) {
  const monitorFunc = `
async function reportToMonitor(apiCalls: number, bytes: number) {
  try {
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://promptsfa.ir'
    await fetch(APP_URL + '/api/debug/realtime-monitor?action=update&calls=' + apiCalls + '&bytes=' + bytes, {
      signal: AbortSignal.timeout(2000)
    }).catch(() => {})
  } catch (err) {}
}
`
  s = s.replace('export async function GET', monitorFunc + '\nexport async function GET')
  console.log('✅ Added monitor reporting function')
}

// Add reporting after each API call
if (!s.includes('reportToMonitor(1, 500)')) {
  // After forwardMessage
  s = s.replace(
    /const f1 = await \(await fetch\(api\('forwardMessage'/g,
    `await reportToMonitor(1, 500)
    const f1 = await (await fetch(api('forwardMessage'`
  )
  
  // After getFile
  s = s.replace(
    /const fr = await \(await fetch\(api\('getFile'/g,
    `await reportToMonitor(1, 200)
    const fr = await (await fetch(api('getFile'`
  )
  
  // After Gemini call
  s = s.replace(
    /ai = await analyzeWithGemini/g,
    `await reportToMonitor(1, 150)
    ai = await analyzeWithGemini`
  )
  
  console.log('✅ Added reporting after API calls')
}

fs.writeFileSync(p, s)
NODEEOF

# ---------- 3) Create simple status page for easy viewing ----------
mkdir -p src/app/api/debug/live-status
cat > src/app/api/debug/live-status/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const snapshotStr = (await prisma.setting.findUnique({ where: { key: 'monitor_snapshot' } }))?.value
  
  if (!snapshotStr) {
    return NextResponse.json({
      ok: true,
      message: 'No active monitoring session',
      instructions: {
        step1: 'Start monitoring: ?action=start',
        step2: 'Run import-loop',
        step3: 'Check status: ?action=status',
      }
    })
  }

  const snapshot = JSON.parse(snapshotStr)
  const currentPrompts = await prisma.prompt.count()
  const newPrompts = currentPrompts - snapshot.startPrompts

  return NextResponse.json({
    ok: true,
    status: {
      started: snapshot.startTime,
      elapsed: Date.now() - new Date(snapshot.startTime).getTime(),
      newPrompts,
      apiCalls: snapshot.startApiCalls,
      estimatedMB: (snapshot.estimatedBytes / 1024 / 1024).toFixed(3),
    },
    quickView: `✅ ${newPrompts} پرامپت جدید | 📡 ${(snapshot.estimatedBytes / 1024 / 1024).toFixed(3)} MB مصرف |  ${snapshot.startApiCalls} API call`,
  })
}
EOF
echo "✅ Live status route created"

echo ""
echo "===== HOW TO USE REAL-TIME MONITOR ====="
echo ""
echo "Step 1: Start monitoring session"
echo "  https://promptsfa.ir/api/debug/realtime-monitor?key=pv-cron-8x2m1q&action=start"
echo ""
echo "Step 2: Run import-loop (10 prompts)"
echo "  https://promptsfa.ir/api/import-loop?key=pv-cron-8x2m1q&count=10"
echo ""
echo "Step 3: Check live status (refresh anytime)"
echo "  https://promptsfa.ir/api/debug/realtime-monitor?key=pv-cron-8x2m1q&action=status"
echo ""
echo "Step 4: Quick view"
echo "  https://promptsfa.ir/api/debug/live-status?key=pv-cron-8x2m1q"
echo ""
echo "======================================"

echo "✅ update215 done!"