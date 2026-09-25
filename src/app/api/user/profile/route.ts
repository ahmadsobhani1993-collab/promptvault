export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ابتدا وارد حساب شوید' }, { status: 401 })
    }

    const { name, bio, image, telegram, instagram } = await req.json()

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(bio !== undefined && { bio: String(bio).trim() }),
        ...(image !== undefined && { image: String(image).trim() }),
        ...(telegram !== undefined && { telegram: telegram ? String(telegram).trim() : null }),
        ...(instagram !== undefined && { instagram: instagram ? String(instagram).trim() : null }),
      },
    })

    return NextResponse.json({ ok: true, user: updatedUser })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'خطا در ویرایش پروفایل' }, { status: 500 })
  }
}