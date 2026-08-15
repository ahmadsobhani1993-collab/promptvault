import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const counts = await prisma.telegramQueue.groupBy({
    by: ['status'],
    _count: true,
  })

  const sample = await prisma.telegramQueue.findMany({
    take: 5,
    orderBy: { id: 'asc' },
  })

  const pending = await prisma.telegramQueue.findFirst({
    where: { status: 'PENDING' },
    orderBy: { id: 'asc' },
  })

  const lastFailed = await prisma.telegramQueue.findFirst({
    where: { status: 'FAILED' },
    orderBy: { id: 'desc' },
  })

  return NextResponse.json({
    counts,
    sample: sample.map((s) => ({
      id: s.id,
      status: s.status,
      hasText: !!(s.text && s.text.trim()),
      textLen: s.text?.length ?? 0,
      textPreview: (s.text ?? '').slice(0, 80),
      hasImg: !!s.img,
      img: s.img,
      reply: s.reply,
    })),
    nextPending: pending
      ? {
          id: pending.id,
          hasText: !!(pending.text && pending.text.trim()),
          textLen: pending.text?.length ?? 0,
          textPreview: (pending.text ?? '').slice(0, 200),
          hasImg: !!pending.img,
          img: pending.img,
          reply: pending.reply,
        }
      : null,
    lastFailed,
  })
}
