import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { promptId, action } = await req.json()
  if (!promptId || !['save', 'unsave'].includes(action)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const userId = session.user.id

  if (action === 'save') {
    await prisma.save.create({ data: { userId, promptId } }).catch(() => {})
    await prisma.prompt.update({
      where: { id: promptId },
      data: { saves: { increment: 1 } },
    }).catch(() => {})
  } else {
    await prisma.save.delete({ where: { userId_promptId: { userId, promptId } } }).catch(() => {})
    await prisma.prompt.update({
      where: { id: promptId },
      data: { saves: { decrement: 1 } },
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
