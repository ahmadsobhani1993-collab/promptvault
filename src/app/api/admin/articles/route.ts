import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { tgSendText } from '@/lib/telegram'

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
    if (!titleFa) return NextResponse.json({ error: 'title required' }, { status: 400 })
    const descFa = String(j.descFa ?? titleFa).trim()
    const contentRaw = String(j.contentFa ?? '')
    const tagFa = String(j.tagFa ?? 'هوش مصنوعی').trim()
    const img = String(j.img ?? '').trim() || 'https://image.pollinations.ai/prompt/' + encodeURIComponent(titleFa) + '?width=1200&height=630&nologo=true'
    const a = await prisma.article.create({
      data: {
        slug: 'manual-' + now.getTime().toString(36),
        titleFa,
        titleEn: titleFa,
        descFa,
        descEn: descFa,
        img,
        tagFa,
        tagEn: tagFa,
        dateFa,
        dateEn,
        readFa: '۵ دقیقه مطالعه',
        readEn: '5 min read',
        contentFa: contentRaw.split(/\n/).map((x: string) => x.trim()).filter(Boolean),
        contentEn: contentRaw.split(/\n/).map((x: string) => x.trim()).filter(Boolean),
        status: 'PUBLISHED',
      },
    })
    return NextResponse.json({ ok: true, slug: a.slug })
  }

  if (action === 'delete') {
    await prisma.article.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  }
  if (action === 'publish') {
    const a = await prisma.article.update({ where: { id }, data: { status: 'PUBLISHED' } })
    const out = process.env.TELEGRAM_OUTPUT
    if (out) await tgSendText(out, '📚 ' + a.titleFa + '\n\n🔗 ' + (process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir') + '/blog/' + a.slug).catch(() => {})
    return NextResponse.json({ ok: true })
  }
  if (action === 'unpublish') {
    await prisma.article.update({ where: { id }, data: { status: 'PENDING' } })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'bad action' }, { status: 400 })
}
