import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { text, targetId, targetType } = await req.json()
  if (!text || !targetId || !['prompt', 'article'].includes(targetType)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const data: any = {
    name: session.user.name ?? 'کاربر',
    text,
    userId: session.user.id,
  }
  if (targetType === 'prompt') data.promptId = targetId
  if (targetType === 'article') data.articleId = targetId

  const comment = await prisma.comment.create({
    data,
    include: { user: true },
  })

  return NextResponse.json({
    id: comment.id,
    name: session.user.name ?? 'کاربر',
    image: session.user.image ?? null,
    text: comment.text,
    createdAt: new Date(comment.createdAt).toLocaleString('fa-IR'),
  })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const targetId = searchParams.get('id')
  const targetType = searchParams.get('type')

  if (!targetId || !['prompt', 'article'].includes(targetType ?? '')) {
    return NextResponse.json([], { status: 400 })
  }

  const where: any = {}
  if (targetType === 'prompt') where.promptId = targetId
  if (targetType === 'article') where.articleId = targetId

  const comments = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  })

  return NextResponse.json(
    comments.map((c) => ({
      id: c.id,
      name: c.user?.name ?? c.name,
      image: c.user?.image ?? null,
      text: c.text,
      createdAt: new Date(c.createdAt).toLocaleString('fa-IR'),
    }))
  )
}
