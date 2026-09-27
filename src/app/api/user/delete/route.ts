export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'شما وارد حساب نشده‌اید' }, { status: 401 })
    }

    const { action, code } = await req.json()
    const userId = session.user.id

    if (action === 'request') {
      const user = await prisma.user.findUnique({ where: { id: userId } })
      
      if (!user?.telegram) {
        return NextResponse.json({ error: 'برای حذف حساب، ابتدا باید حساب تلگرام خود را در تنظیمات متصل کنید.' }, { status: 400 })
      }

      const deleteCode = Math.floor(100000 + Math.random() * 900000).toString()
      const deleteCodeExpires = new Date(Date.now() + 10 * 60 * 1000)

      await prisma.user.update({
        where: { id: userId },
        data: { deleteCode, deleteCodeExpires },
      })

      console.log(`[DEV] Delete code for user ${userId} (Telegram: ${user.telegram}): ${deleteCode}`)

      return NextResponse.json({ ok: true, message: 'کد تایید به تلگرام شما ارسال شد. (در حالت توسعه در کنسول سرور قابل مشاهده است)' })
    }

    if (action === 'confirm') {
      if (!code) {
        return NextResponse.json({ error: 'کد تایید الزامی است' }, { status: 400 })
      }

      const user = await prisma.user.findUnique({ where: { id: userId } })
      
      if (!user || user.deleteCode !== code) {
        return NextResponse.json({ error: 'کد وارد شده نامعتبر است' }, { status: 400 })
      }

      if (!user.deleteCodeExpires || new Date() > user.deleteCodeExpires) {
        return NextResponse.json({ error: 'کد تایید منقضی شده است. لطفاً دوباره درخواست دهید.' }, { status: 400 })
      }

      await prisma.$transaction([
        prisma.like.deleteMany({ where: { userId } }),
        prisma.save.deleteMany({ where: { userId } }),
        prisma.comment.deleteMany({ where: { userId } }),
        prisma.prompt.deleteMany({ where: { userId } }),
        prisma.bookmark.deleteMany({ where: { userId } }),
        prisma.cartItem.deleteMany({ where: { userId } }),
        prisma.order.deleteMany({ where: { userId } }),
        prisma.notification.deleteMany({ where: { userId } }),
        prisma.pushSubscription.deleteMany({ where: { userId } }),
        prisma.session.deleteMany({ where: { userId } }),
        prisma.account.deleteMany({ where: { userId } }),
        prisma.user.delete({ where: { id: userId } }),
      ])

      return NextResponse.json({ ok: true, message: 'حساب شما با موفقیت حذف شد.' })
    }

    return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  } catch (error: any) {
    console.error('Delete account error:', error)
    return NextResponse.json({ error: 'خطا در پردازش درخواست' }, { status: 500 })
  }
}
