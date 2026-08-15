import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyImage } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const start = Date.now()
  const prompts = await prisma.prompt.findMany({
    where: { slug: { startsWith: 'tg-' } },
    select: { id: true, img: true },
  })

  let checked = 0
  let deleted = 0
  for (const p of prompts) {
    if (Date.now() - start > 45000) break
    checked++
    const ok = await verifyImage(p.img)
    if (!ok) {
      await prisma.prompt.delete({ where: { id: p.id } })
      deleted++
    }
  }

  return NextResponse.json({ ok: true, checked, deleted, total: prompts.length })
}
