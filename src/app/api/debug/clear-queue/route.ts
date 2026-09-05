import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const result = await prisma.telegramQueue.deleteMany({})

  return NextResponse.json({
    ok: true,
    deleted: result.count,
    message: `Queue cleared: ${result.count} items removed`,
    timestamp: new Date().toISOString(),
  })
}
