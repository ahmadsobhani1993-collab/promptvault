import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const rows = await prisma.prompt.findMany({ select: { id: true, titleFa: true, titleEn: true } })
  const re = /^(\S+)\s+\1/
  let fixed = 0
  for (const r of rows) {
    const fa = re.test(r.titleFa) ? r.titleFa.replace(re, '$1') : r.titleFa
    const en = re.test(r.titleEn) ? r.titleEn.replace(re, '$1') : r.titleEn
    if (fa !== r.titleFa || en !== r.titleEn) {
      await prisma.prompt.update({ where: { id: r.id }, data: { titleFa: fa, titleEn: en } })
      fixed++
    }
  }
  return NextResponse.json({ ok: true, fixed })
}
