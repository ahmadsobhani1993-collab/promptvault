import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { articleId, newImageUrl } = await req.json()
  if (!articleId || !newImageUrl) {
    return NextResponse.json({ error: 'articleId and newImageUrl required' }, { status: 400 })
  }

  await prisma.article.update({
    where: { id: articleId },
    data: { img: newImageUrl },
  })

  return NextResponse.json({ ok: true, message: 'image replaced' })
}
