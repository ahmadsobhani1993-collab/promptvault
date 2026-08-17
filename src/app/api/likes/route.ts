import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { notify } from '@/lib/notify'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 })

  const { promptId, action } = await req.json()
  if (!promptId || !['like', 'unlike'].includes(action)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const userId = session.user.id

  if (action === 'like') {
    await prisma.like.create({ data: { userId, promptId } }).catch(() => {})
    await prisma.prompt.update({ where: { id: promptId }, data: { likes: { increment: 1 } } }).catch(() => {})

    const p = await prisma.prompt.findUnique({ where: { id: promptId }, select: { userId: true, slug: true, titleFa: true } })
    if (p?.userId && p.userId !== userId) {
      await notify(p.userId, 'LIKE', '❤️ یک نفر پرامپت «' + p.titleFa + '» را پسندید', '/prompts/' + p.slug)
    }
  } else {
    await prisma.like.delete({ where: { userId_promptId: { userId, promptId } } }).catch(() => {})
    await prisma.prompt.update({ where: { id: promptId }, data: { likes: { decrement: 1 } } }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
