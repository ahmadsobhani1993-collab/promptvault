import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const [total, today, schema] = await Promise.all([
    prisma.pageView.count(),
    prisma.pageView.count({
      where: {
        createdAt: {
          gte: new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date()) + 'T00:00:00+03:30')
        }
      }
    }),
    prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'PageView'`
  ])

  return NextResponse.json({
    ok: true,
    total,
    today,
    schema: JSON.parse(JSON.stringify(schema))
  })
}
