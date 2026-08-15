import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const hits = new Map<string, number[]>()

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const now = Date.now()
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000)
  if (arr.length >= 30) return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  arr.push(now)
  hits.set(ip, arr)

  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const p = await prisma.prompt.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: { prompt: true },
  })
  if (!p) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({ prompt: p.prompt })
}
