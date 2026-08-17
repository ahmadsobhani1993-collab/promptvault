import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const rows = await prisma.prompt.findMany({
    where: { NOT: { imgData: null } },
    select: { id: true, imgData: true, imgType: true },
    take: 50,
  })

  let moved = 0
  for (const r of rows) {
    if (!r.imgData) continue
    await prisma.promptImage.upsert({
      where: { promptId: r.id },
      update: {},
      create: { promptId: r.id, data: r.imgData, type: r.imgType },
    })
    await prisma.prompt.update({ where: { id: r.id }, data: { imgData: null, imgType: null } })
    moved++
  }

  const left = await prisma.prompt.count({ where: { NOT: { imgData: null } } })
  return NextResponse.json({ ok: true, moved, left })
}
