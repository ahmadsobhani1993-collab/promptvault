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
