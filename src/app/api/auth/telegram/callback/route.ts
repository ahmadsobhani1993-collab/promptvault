export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://promptsfa.ir'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(`${APP_URL}/login?error=missing_token`)
    }

    const loginToken = await prisma.loginToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!loginToken || !loginToken.confirmed || !loginToken.user) {
      return NextResponse.redirect(`${APP_URL}/login?error=unauthorized_token`)
    }

    // ثبت نشست در کوکی یا هدایت به حساب کاربری
    const cookieStore = await cookies()
    cookieStore.set('telegram_auth_user', loginToken.user.id, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 روز
    })

    // ابطال یا حذف توکن مصرف شده
    await prisma.loginToken.delete({
      where: { token },
    }).catch(() => {})

    return NextResponse.redirect(`${APP_URL}/`)
  } catch (err) {
    console.error('Telegram callback error:', err)
    return NextResponse.redirect(`${APP_URL}/login?error=callback_failed`)
  }
}
