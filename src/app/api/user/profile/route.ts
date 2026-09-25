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

    const { name, username, bio, image, telegram, instagram } = await req.json()

    // بررسی تکراری نبودن نام کاربری
    if (username) {
      const cleanUsername = String(username).toLowerCase().trim().replace(/[^a-z0-9_]/g, '')
      const existing = await prisma.user.findFirst({
        where: {
          username: cleanUsername,
          NOT: { id: session.user.id },
        },
      })
      if (existing) {
        return NextResponse.json({ error: 'این نام کاربری قبلاً انتخاب شده است.' }, { status: 400 })
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(username !== undefined && {
          username: username ? String(username).toLowerCase().trim().replace(/[^a-z0-9_]/g, '') : null,
        }),
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