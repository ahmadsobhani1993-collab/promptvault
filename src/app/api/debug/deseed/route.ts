import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const res = await prisma.prompt.deleteMany({
    where: {
      slug: { not: { startsWith: 'tg-' } },
      userId: null,
      status: 'PUBLISHED',
    },
  })

  return NextResponse.json({ ok: true, deletedDemo: res.count })
}
