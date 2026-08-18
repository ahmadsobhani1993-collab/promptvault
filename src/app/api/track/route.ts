import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const j = await req.json().catch(() => ({}))
    const path = String(j.path ?? '/').slice(0, 300)
    const referrer = String(j.referrer ?? '').slice(0, 500) || null
    const ua = (req.headers.get('user-agent') ?? '').slice(0, 300) || null
    const fwd = req.headers.get('x-forwarded-for') ?? ''
    const ip = fwd.split(',')[0]?.trim() || null
    await prisma.pageView.create({ data: { path, referrer, ua, ip } })
  } catch {}
  return NextResponse.json({ ok: true })
}
