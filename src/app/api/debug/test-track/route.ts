import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Create a test pageview
  await prisma.pageView.create({
    data: {
      path: '/test-manual',
      referrer: 'manual-test',
      ua: 'test-agent',
      ip: '127.0.0.1',
    }
  })

  const count = await prisma.pageView.count()
  return NextResponse.json({ ok: true, total: count, message: 'test pageview created' })
}
