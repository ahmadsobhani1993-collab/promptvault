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

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { username: true },
    })

    const { name, username, bio, image, telegram, instagram } = await req.json()

    let newUsernameData = undefined

    // اگر کاربر قبلاً یوزرنیم نداشته، اکنون می‌تواند یکتا انتخاب کند
    if (!currentUser?.username && username) {
      const cleanUsername = String(username).toLowerCase().trim().replace(/[^a-z0-9_]/g, '')
      if (cleanUsername.length < 3) {
        return NextResponse.json({ error: 'نام کاربری باید حداقل ۳ کاراکتر انگلیسی باشد.' }, { status: 400 })
      }
      const existing = await prisma.user.findFirst({
        where: { username: cleanUsername },
      })
      if (existing) {
        return NextResponse.json({ error: 'این نام کاربری قبلاً توسط شخص دیگری انتخاب شده است.' }, { status: 400 })
      }
      newUsernameData = cleanUsername
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(newUsernameData !== undefined && { username: newUsernameData }),
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