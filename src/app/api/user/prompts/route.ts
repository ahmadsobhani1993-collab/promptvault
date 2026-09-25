export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'لطفاً ابتدا وارد شوید' }, { status: 401 })
    }

    const body = await req.json()
    const { id, titleFa, titleEn, prompt, descFa, usageFa, model } = body

    if (!id) {
      return NextResponse.json({ error: 'شناسه پرامپت الزامی است' }, { status: 400 })
    }

    const currentUserId = session.user.id

    const existingPrompt = await prisma.prompt.findUnique({
      where: { id: String(id) },
      select: { id: true, userId: true },
    })

    if (!existingPrompt) {
      return NextResponse.json({ error: 'پرامپت پیدا نشد' }, { status: 404 })
    }

    const isOwner = existingPrompt.userId === currentUserId
    const isAdmin = (session.user as any)?.role === 'ADMIN'

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'شما اجازه ویرایش این پرامپت را ندارید' }, { status: 403 })
    }

    const updated = await prisma.prompt.update({
      where: { id: String(id) },
      data: {
        ...(titleFa && { titleFa: String(titleFa).trim() }),
        ...(titleEn && { titleEn: String(titleEn).trim() }),
        ...(prompt && { prompt: String(prompt).trim() }),
        ...(descFa !== undefined && { descFa: String(descFa).trim() }),
        ...(usageFa !== undefined && { usageFa: String(usageFa).trim() }),
        ...(model && { model: String(model).trim() }),
      },
    })

    return NextResponse.json({ ok: true, prompt: updated })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'خطا در ویرایش پرامپت' }, { status: 500 })
  }
}
