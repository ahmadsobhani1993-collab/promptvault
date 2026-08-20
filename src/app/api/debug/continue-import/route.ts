import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const newLimit = parseInt(searchParams.get('limit') || '10000')
  const batchSize = parseInt(searchParams.get('batch') || '50')

  const currentCursor = parseInt((await prisma.setting.findUnique({ where: { key: 'import_cursor' } }))?.value || '0')
  const currentStop = parseInt((await prisma.setting.findUnique({ where: { key: 'import_stop' } }))?.value || '3660')
  const totalPrompts = await prisma.prompt.count()

  // Update stop limit
  await prisma.setting.upsert({
    where: { key: 'import_stop' },
    update: { value: String(newLimit) },
    create: { key: 'import_stop', value: String(newLimit) }
  })

  // Calculate estimated network usage
  const remainingMessages = newLimit - currentCursor
  const estimatedMB = (remainingMessages * 1.4 / 1024).toFixed(2) // 1.4KB per message

  return NextResponse.json({
    ok: true,
    status: {
      currentCursor,
      previousStop: currentStop,
      newStop: newLimit,
      totalPromptsImported: totalPrompts,
      remainingMessages,
    },
    networkEstimate: {
      estimatedMB,
      yourRemainingQuota: '600 MB',
      safe: parseFloat(estimatedMB) < 600,
      message: `بررسی ${remainingMessages} پیام باقی‌مانده فقط ~${estimatedMB} MB مصرف می‌کند (از 600 MB موجود)`,
    },
    nextStep: `حالا این لینک را بزنید تا ${batchSize} پرامپت جدید ایمپورت شود:\nhttps://promptsfa.ir/api/import-loop?key=pv-cron-8x2m1q&count=${batchSize}`,
    monitorProgress: 'https://promptsfa.ir/api/debug/import-status?key=pv-cron-8x2m1q',
  })
}
