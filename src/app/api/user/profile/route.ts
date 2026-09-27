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
      select: { username: true, telegram: true },
    })

    const { name, username, bio, image, telegram, instagram, telegramHandle } = await req.json()

    let newUsernameData = undefined
    if (!currentUser?.username && username) {
      const cleanUsername = String(username).toLowerCase().trim().replace(/[^a-z0-9_]/g, '')
      if (cleanUsername.length < 3) {
        return NextResponse.json({ error: 'نام کاربری باید حداقل ۳ کاراکتر انگلیسی باشد.' }, { status: 400 })
      }
      const existing = await prisma.user.findFirst({ where: { username: cleanUsername } })
      if (existing) {
        return NextResponse.json({ error: 'این نام کاربری قبلاً توسط شخص دیگری انتخاب شده است.' }, { status: 400 })
      }
      newUsernameData = cleanUsername
    }

    let newTelegramHandle = undefined
    if (telegramHandle !== undefined) {
      const cleanHandle = String(telegramHandle).replace(/^@/, '').trim()
      if (cleanHandle === '') {
        newTelegramHandle = null
      } else if (!/^[a-zA-Z0-9_]{3,32}$/.test(cleanHandle)) {
        return NextResponse.json({ error: 'آیدی تلگرام نامعتبر است' }, { status: 400 })
      } else {
        const existing = await prisma.user.findFirst({ where: { telegramHandle: cleanHandle } })
        if (existing && existing.id !== session.user.id) {
          return NextResponse.json({ error: 'این آیدی تلگرام قبلاً ثبت شده است.' }, { status: 400 })
        }
        newTelegramHandle = cleanHandle
      }
    }

    let mergeOccurred = false
    if (telegram && telegram !== currentUser?.telegram) {
      const existingTelegramUser = await prisma.user.findUnique({ where: { telegram } })
      
      if (existingTelegramUser && existingTelegramUser.id !== session.user.id) {
        await prisma.$transaction(async (tx) => {
          await tx.prompt.updateMany({ where: { userId: existingTelegramUser.id }, data: { userId: session.user.id } })
          await tx.like.updateMany({ where: { userId: existingTelegramUser.id }, data: { userId: session.user.id } })
          await tx.save.updateMany({ where: { userId: existingTelegramUser.id }, data: { userId: session.user.id } })
          await tx.comment.updateMany({ where: { userId: existingTelegramUser.id }, data: { userId: session.user.id } })
          await tx.bookmark.updateMany({ where: { userId: existingTelegramUser.id }, data: { userId: session.user.id } })
          await tx.user.delete({ where: { id: existingTelegramUser.id } })
        })
        mergeOccurred = true
      }
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
        ...(newTelegramHandle !== undefined && { telegramHandle: newTelegramHandle }),
      },
    })

    return NextResponse.json({ 
      ok: true, 
      user: updatedUser,
      message: mergeOccurred ? 'حساب تلگرام با موفقیت به این حساب متصل و ادغام شد.' : 'پروفایل با موفقیت به‌روزرسانی شد.'
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'خطا در ویرایش پروفایل' }, { status: 500 })
  }
}
