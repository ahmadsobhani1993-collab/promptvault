import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const totalPrompts = await prisma.prompt.count()
  const withDesc = await prisma.prompt.count({ where: { descFa: { not: null, not: '' } } })
  const withTags = await prisma.prompt.count({ where: { tagsFa: { isEmpty: false } } })

  return NextResponse.json({
    ok: true,
    totalPrompts,
    withDescription: withDesc,
    withTags: withTags,
    message: 'SEO audit completed',
  })
}
