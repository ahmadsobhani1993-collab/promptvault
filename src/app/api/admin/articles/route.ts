import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { tgSendText } from '@/lib/telegram'

export async function POST(req: Request) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { id, action } = await req.json()

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
