export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const MAX_ITEMS = 20
const MAX_BYTES = 20_000
const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|preview|fetch|curl|wget|python|node/i
const PROMPT_PATH = /^\/(?:en\/)?prompts\/([^/?#]+)\/?$/

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

    const items = batch.slice(0, MAX_ITEMS)

    const data = items.map((item: any) => ({
      path: String(item?.path ?? '/').slice(0, 300),
      referrer: String(item?.referrer ?? '').slice(0, 500) || null,
      ua: ua.slice(0, 200),
      ip: '',
    }))

    await prisma.pageView.createMany({ data })

    // Prompt view counters: one grouped update per slug
    const counts = new Map<string, number>()
    for (const item of items) {
      const m = PROMPT_PATH.exec(String(item?.path ?? ''))
      if (!m) continue
      let slug = m[1]
      try {
        slug = decodeURIComponent(slug)
      } catch {}
      if (!slug || slug.length > 200) continue
      counts.set(slug, (counts.get(slug) || 0) + 1)
    }

    if (counts.size > 0) {
      await prisma
        .$transaction(
          Array.from(counts, ([slug, n]) =>
            prisma.prompt.updateMany({ where: { slug }, data: { views: { increment: n } } })
          )
        )
        .catch((e) => console.error('views increment failed:', e))
    }

    return NextResponse.json({ ok: true, inserted: data.length })
  } catch (err) {
    console.error('Batch track error:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}