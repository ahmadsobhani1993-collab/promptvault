import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const cursor = parseInt((await prisma.setting.findUnique({ where: { key: 'import_cursor' } }))?.value || '0')
  const stop = parseInt((await prisma.setting.findUnique({ where: { key: 'import_stop' } }))?.value || '3660')
  const totalPrompts = await prisma.prompt.count()

  const remaining = Math.max(0, stop - cursor)
  const estimatedMB = remaining * 0.005 // 5KB per import (optimized)
  const estimatedGB = (estimatedMB / 1024).toFixed(3)

  return NextResponse.json({
    ok: true,
    status: {
      cursor,
      stop,
      remaining,
      totalPrompts,
      completed: cursor > 100 ? cursor - 100 : 0,
    },
    projection: {
      estimatedMB: estimatedMB.toFixed(2),
      estimatedGB,
      hint: remaining > 0 
        ? `هنوز ${remaining} پرامپت باقی مانده. با بهینه‌سازی جدید، فقط ~${estimatedMB.toFixed(2)}MB مصرف می‌شود (نه ${estimatedGB}GB!)`
        : '✅ Import کامل شده! دیگر مصرفی برای import نخواهیم داشت.',
      recommendation: 'اگر نمی‌خواهی هیچ مصرفی باشد، در cron-job.org job import-loop را غیرفعال کن',
    },
  })
}
