export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { articleContentToHtml } from '@/lib/article-content'

function articleBody(value: unknown): string[] {
  const raw = typeof value === 'string' ? value : Array.isArray(value) ? value.join('\n\n') : ''
  return raw.trim() ? [articleContentToHtml(raw)] : []
}

export async function POST(req: Request) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const j = await req.json()
  const { id, action } = j

    if (action === 'create') {
    const now = new Date()
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now)
    const dateFa = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'long', day: 'numeric' }).format(now)
    const dateEn = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'long', day: 'numeric' }).format(now)
    const titleFa = String(j.titleFa ?? '').trim()
    const titleEn = String(j.titleEn ?? '').trim()
    if (!titleFa || !titleEn) return NextResponse.json({ error: 'Persian and English titles are required' }, { status: 400 })
    const descFa = String(j.descFa ?? titleFa).trim()
    const descEn = String(j.descEn ?? titleEn).trim()
    const tagFa = String(j.tagFa ?? 'هوش مصنوعی').trim()
    const tagEn = String(j.tagEn ?? 'Artificial Intelligence').trim()
    const img = String(j.img ?? '').trim()
    const contentFa = articleBody(j.contentFa)
    const contentEn = articleBody(j.contentEn)
    if (!img) return NextResponse.json({ error: 'cover image required' }, { status: 400 })
    if (!contentFa.length || !contentEn.length) return NextResponse.json({ error: 'Both Persian and English article bodies are required' }, { status: 400 })
    const a = await prisma.article.create({
      data: {
        slug: 'manual-' + now.getTime().toString(36),
        titleFa,
        titleEn,
        descFa,
        descEn,
        img,
        tagFa,
        tagEn,
        dateFa,
        dateEn,
        readFa: '۵ دقیقه مطالعه',
        readEn: '5 min read',
        contentFa,
        contentEn,
        status: 'PUBLISHED',
      },
    })
    return NextResponse.json({ ok: true, slug: a.slug })
  }

    if (action === 'update') {
    const article = await prisma.article.findUnique({ where: { id } })
    if (!article) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const titleFa = String(j.titleFa ?? '').trim()
    const titleEn = String(j.titleEn ?? '').trim()
    if (!titleFa || !titleEn) return NextResponse.json({ error: 'Persian and English titles are required' }, { status: 400 })
    
    const descFa = String(j.descFa ?? titleFa).trim()
    const descEn = String(j.descEn ?? titleEn).trim()
    const img = String(j.img ?? '').trim() || article.img
    const contentFa = articleBody(j.contentFa)
    const contentEn = articleBody(j.contentEn)
    if (!contentFa.length || !contentEn.length) return NextResponse.json({ error: 'Both Persian and English article bodies are required' }, { status: 400 })
    
    await prisma.article.update({
      where: { id },
      data: {
        titleFa,
        titleEn,
        descFa,
        descEn,
        img,
        tagFa: String(j.tagFa ?? 'هوش مصنوعی').trim(),
        tagEn: String(j.tagEn ?? 'Artificial Intelligence').trim(),
        contentFa,
        contentEn,
      },
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete') {
    await prisma.article.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  }
  if (action === 'publish') {
    const a = await prisma.article.update({ where: { id }, data: { status: 'PUBLISHED' } })
        return NextResponse.json({ ok: true })
  }
  if (action === 'unpublish') {
    await prisma.article.update({ where: { id }, data: { status: 'PENDING' } })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'bad action' }, { status: 400 })
}
