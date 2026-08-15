import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const { promptId } = await req.json()
  if (!promptId) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const p = await prisma.prompt.update({
    where: { id: promptId },
    data: { stars: { increment: 1 } },
  })

  return NextResponse.json({ ok: true, stars: p.stars })
}
