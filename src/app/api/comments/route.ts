import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { notify } from '@/lib/notify'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 })

  const { text, targetId, targetType, parentId } = await req.json()
  if (!text || !targetId || !['prompt', 'article'].includes(targetType)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const data: any = {
    name: session.user.name ?? 'کاربر',
    text,
    userId: session.user.id,
  }
  if (parentId) data.parentId = parentId
  if (targetType === 'prompt') data.promptId = targetId
  if (targetType === 'article') data.articleId = targetId

  const comment = await prisma.comment.create({ data, include: { user: true } })

  // notifications
  if (targetType === 'prompt') {
    const p = await prisma.prompt.findUnique({ where: { id: targetId }, select: { userId: true, slug: true, titleFa: true } })
    if (p?.userId && p.userId !== session.user.id) {
      await notify(p.userId, 'COMMENT', '💬 دیدگاه جدید روی پرامپت «' + p.titleFa + '»', '/prompts/' + p.slug)
    }
    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId }, select: { userId: true } })
      if (parent?.userId && parent.userId !== session.user.id && parent.userId !== p?.userId) {
        await notify(parent.userId, 'REPLY', '↩️ پاسخی به دیدگاه تو داده شد', p ? '/prompts/' + p.slug : '/')
      }
    }
  }

  return NextResponse.json({
    id: comment.id,
    parentId: comment.parentId ?? null,
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

  const comments = await prisma.comment.findMany({ where, orderBy: { createdAt: 'desc' }, include: { user: true } })

  return NextResponse.json(
    comments.map((c) => ({
      id: c.id,
      parentId: c.parentId ?? null,
      name: c.user?.name ?? c.name,
      image: c.user?.image ?? null,
      text: c.text,
      createdAt: new Date(c.createdAt).toLocaleString('fa-IR'),
    }))
  )
}
