import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const pending = await prisma.prompt.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 5,
  })

  const ids = pending.map((p) => p.id)

  if (ids.length) {
    await prisma.prompt.updateMany({
      where: { id: { in: ids } },
      data: { status: 'PUBLISHED' },
    })
  }

  return NextResponse.json({
    ok: true,
    published: ids.length,
    slugs: pending.map((p) => p.slug),
  })
}
ENDOFFILEmkdir -p src/app/api/cron/publish
cat > src/app/api/cron/publish/route.ts << 'ENDOFFILE'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const pending = await prisma.prompt.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 5,
  })

  const ids = pending.map((p) => p.id)

  if (ids.length) {
    await prisma.prompt.updateMany({
      where: { id: { in: ids } },
      data: { status: 'PUBLISHED' },
    })
  }

  return NextResponse.json({
    ok: true,
    published: ids.length,
    slugs: pending.map((p) => p.slug),
  })
}
