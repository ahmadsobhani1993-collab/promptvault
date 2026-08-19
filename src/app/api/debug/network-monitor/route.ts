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
