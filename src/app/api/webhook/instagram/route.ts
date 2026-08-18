import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendToInstagramCustom } from '@/lib/instagram'

// Webhook for Buffer, Later, n8n, Zapier, IFTTT, etc.
// POST with { slug, caption? } or { promptId, caption? }
export async function POST(req: Request) {
  try {
    const j = await req.json()
    const { slug, promptId, caption } = j

    let p: any = null
    if (slug) p = await prisma.prompt.findUnique({ where: { slug } })
    else if (promptId) p = await prisma.prompt.findUnique({ where: { id: promptId } })

    if (!p) return NextResponse.json({ error: 'prompt not found' }, { status: 404 })

    const defaultCaption = (p.tagsFa ?? []).map((t: string) => '#' + t.replace(/\s+/g, '_')).join(' ') +
      '\n\nبرای دریافت پرامپت‌های بیشتر به سایت ما مراجعه کنید\n' +
      'برای دریافت این پرامپت ابتدا ما را فالو کرده و سپس کلمه PROMPT را ارسال کنید.'

    const result = await sendToInstagramCustom(p, caption ?? defaultCaption)
    return NextResponse.json({ ok: true, result })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 })
  }
}
