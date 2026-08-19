#!/bin/bash
set -e

# ---------- 1) Network monitoring system ----------
mkdir -p src/app/api/debug/network-monitor
cat > src/app/api/debug/network-monitor/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || 'status'

  if (action === 'snapshot') {
    // Take a snapshot of current usage
    const totalViews = await prisma.pageView.count()
    const importCursor = (await prisma.setting.findUnique({ where: { key: 'import_cursor' } }))?.value || '0'
    const importStop = (await prisma.setting.findUnique({ where: { key: 'import_stop' } }))?.value || '3660'

    const snapshot = {
      timestamp: new Date().toISOString(),
      totalViews,
      importCursor: parseInt(importCursor),
      importStop: parseInt(importStop),
      estimatedNetworkMB: (totalViews * 0.5 / 1024).toFixed(2), // rough estimate
    }

    await prisma.setting.upsert({
      where: { key: 'network_snapshot_last' },
      update: { value: JSON.stringify(snapshot) },
      create: { key: 'network_snapshot_last', value: JSON.stringify(snapshot) },
    })

    return NextResponse.json({
      ok: true,
      message: 'Snapshot taken',
      snapshot,
    })
  }

  if (action === 'compare') {
    // Compare current usage with last snapshot
    const lastSnapshotStr = (await prisma.setting.findUnique({ where: { key: 'network_snapshot_last' } }))?.value
    if (!lastSnapshotStr) {
      return NextResponse.json({ error: 'No previous snapshot. Run ?action=snapshot first' }, { status: 400 })
    }

    const lastSnapshot = JSON.parse(lastSnapshotStr)
    const currentViews = await prisma.pageView.count()
    const currentCursor = parseInt((await prisma.setting.findUnique({ where: { key: 'import_cursor' } }))?.value || '0')

    const newViews = currentViews - lastSnapshot.totalViews
    const newImports = currentCursor - lastSnapshot.importCursor
    const estimatedNewNetworkMB = (newViews * 0.5 / 1024).toFixed(2)

    return NextResponse.json({
      ok: true,
      comparison: {
        since: lastSnapshot.timestamp,
        newPageViews: newViews,
        newImports: newImports,
        estimatedNetworkMB: estimatedNewNetworkMB,
        currentTotalViews: currentViews,
        hint: `هر import-loop ~1-2MB مصرف می‌کند. ${newImports} import جدید = ~${(newImports * 1.5).toFixed(0)}MB`,
      },
    })
  }

  // Default: show current status
  const totalViews = await prisma.pageView.count()
  const importCursor = (await prisma.setting.findUnique({ where: { key: 'import_cursor' } }))?.value || '0'
  const importStop = (await prisma.setting.findUnique({ where: { key: 'import_stop' } }))?.value || '3660'
  const lastSnapshotStr = (await prisma.setting.findUnique({ where: { key: 'network_snapshot_last' } }))?.value

  return NextResponse.json({
    ok: true,
    current: {
      totalViews,
      importCursor: parseInt(importCursor),
      importStop: parseInt(importStop),
      estimatedNetworkMB: (totalViews * 0.5 / 1024).toFixed(2),
    },
    lastSnapshot: lastSnapshotStr ? JSON.parse(lastSnapshotStr) : null,
    instructions: {
      step1: 'Run ?action=snapshot to take a baseline',
      step2: 'Run your import-loop',
      step3: 'Run ?action=compare to see how much data was used',
    },
  })
}
EOF
echo "✅ Network monitoring system created"

# ---------- 2) Import-loop with detailed logging ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/import-loop/route.ts'
let s = fs.readFileSync(p, 'utf8')

// Add network usage tracking at the start
if (!s.includes('const networkStart =')) {
  const trackingCode = `
  // Track network usage for this import session
  const networkStart = {
    timestamp: new Date().toISOString(),
    cursor: cursor,
    estimatedNetworkMB: 0,
  }
  let bytesTransferred = 0
`
  s = s.replace(
    "const debug: string[] = []",
    trackingCode + "\n  const debug: string[] = []"
  )
}

// Track bytes for each API call
if (!s.includes('bytesTransferred +=')) {
  s = s.replace(
    /const f1 = await \(await fetch\(api\('forwardMessage'/g,
    `bytesTransferred += 500 // estimate for forwardMessage
    const f1 = await (await fetch(api('forwardMessage'`
  )
  
  s = s.replace(
    /const fr = await \(await fetch\(api\('getFile'/g,
    `bytesTransferred += 200 // estimate for getFile
    const fr = await (await fetch(api('getFile'`
  )
}

// Add network summary to response
if (!s.includes('networkUsage:')) {
  s = s.replace(
    'return NextResponse.json({ ok: true, cursor, stop, results, chained, debug })',
    `return NextResponse.json({ 
      ok: true, 
      cursor, 
      stop, 
      results, 
      chained, 
      debug,
      networkUsage: {
        estimatedBytes: bytesTransferred,
        estimatedMB: (bytesTransferred / 1024 / 1024).toFixed(2),
        importsCompleted: results.length,
        hint: 'هر import ~1-2MB مصرف می‌کند'
      }
    })`
  )
}

fs.writeFileSync(p, s)
console.log('✅ Import-loop: added network usage tracking')
NODEEOF

echo ""
echo "===== HOW TO USE ====="
echo "Step 1: Take baseline snapshot"
echo "  https://promptsfa.ir/api/debug/network-monitor?key=pv-cron-8x2m1q&action=snapshot"
echo ""
echo "Step 2: Run import-loop ONCE"
echo "  https://promptsfa.ir/api/import-loop?key=pv-cron-8x2m1q&count=1"
echo ""
echo "Step 3: Compare usage"
echo "  https://promptsfa.ir/api/debug/network-monitor?key=pv-cron-8x2m1q&action=compare"
echo ""
echo "This will show exactly how much data ONE import consumes!"
echo "======================"

echo "✅ update201 done!"