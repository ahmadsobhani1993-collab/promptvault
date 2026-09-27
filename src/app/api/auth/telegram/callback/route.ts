export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { signIn } from '@/auth' // اضافه کردن signIn برای لاگین واقعی

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
    })

    // ✅ اصلاح: بررسی فیلد status به جای confirmed
    if (!loginToken || !loginToken.status?.startsWith('CONFIRMED:')) {
      return NextResponse.redirect(`${APP_URL}/login?error=unauthorized_token`)
    }

    // ✅ استخراج userId از فیلد status (مثلاً "CONFIRMED:123") یا استفاده از userId
    const userId = loginToken.userId || loginToken.status.replace('CONFIRMED:', '')

    if (!userId) {
      return NextResponse.redirect(`${APP_URL}/login?error=no_user_id`)
    }

    // ✅ لاگین واقعی کاربر از طریق NextAuth و ریدایرکت به صفحه اصلی
    await signIn('telegram', {
      userId: userId,
      redirect: true,
      redirectTo: '/'
    })

  } catch (err) {
    console.error('Telegram callback error:', err)
    return NextResponse.redirect(`${APP_URL}/login?error=callback_failed`)
  }
}