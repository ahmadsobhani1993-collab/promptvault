import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const deleted = await prisma.telegramQueue.deleteMany({})
  await prisma.setting.upsert({
    where: { key: 'tg_synced' },
    update: { value: '0' },
    create: { key: 'tg_synced', value: '0' },
  })
  await prisma.setting.upsert({
    where: { key: 'tg_before' },
    update: { value: '0' },
    create: { key: 'tg_before', value: '0' },
  })

  return NextResponse.json({ ok: true, deleted: deleted.count, msg: 'Queue reset — sync will restart from scratch' })
}
