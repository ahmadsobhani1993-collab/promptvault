export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const MAX_ITEMS = 20
const MAX_BYTES = 20_000
const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|preview|fetch|curl|wget|python|node/i

export async function POST(req: Request) {
  try {
    const ua = req.headers.get('user-agent') || ''
    if (!ua || BOT_RE.test(ua)) {
      return NextResponse.json({ ok: true, inserted: 0 })
    }

    const len = Number(req.headers.get('content-length') || 0)
    if (len > MAX_BYTES) {
      return NextResponse.json({ error: 'too large' }, { status: 413 })
    }

    const batch = await req.json()
    if (!Array.isArray(batch) || batch.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 })
    }

    const data = batch.slice(0, MAX_ITEMS).map((item: any) => ({
      path: String(item?.path ?? '/').slice(0, 300),
      referrer: String(item?.referrer ?? '').slice(0, 500) || null,
      ua: ua.slice(0, 200),
      ip: '',
    }))

    await prisma.pageView.createMany({ data })
    return NextResponse.json({ ok: true, inserted: data.length })
  } catch (err) {
    console.error('Batch track error:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}