import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Get current import status
  const [cursor, chained, lastRun] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'import_cursor' } }),
    prisma.setting.findUnique({ where: { key: 'import_chained' } }),
    prisma.setting.findUnique({ where: { key: 'import_last_run' } }),
  ])

  // Count total prompts
  const totalPrompts = await prisma.prompt.count()
  const pendingPrompts = await prisma.prompt.count({ where: { status: 'PENDING' } })
  const publishedPrompts = await prisma.prompt.count({ where: { status: 'PUBLISHED' } })

  return NextResponse.json({
    cursor: cursor?.value || '0',
    chained: chained?.value || 'false',
    lastRun: lastRun?.value || 'never',
    stats: {
      total: totalPrompts,
      pending: pendingPrompts,
      published: publishedPrompts,
    },
    timestamp: new Date().toISOString(),
  })
}
