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
