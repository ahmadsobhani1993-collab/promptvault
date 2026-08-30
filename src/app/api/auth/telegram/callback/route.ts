import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const loginUrl = new URL('/login', req.url)

  if (!token) return NextResponse.redirect(loginUrl)

  const loginToken = await prisma.loginToken.findUnique({ where: { token } })
  if (!loginToken || loginToken.status !== 'APPROVED' || !loginToken.telegramId) {
    return NextResponse.redirect(loginUrl)
  }

  const user = await prisma.user.findUnique({ where: { telegramId: loginToken.telegramId } })
  if (!user) return NextResponse.redirect(loginUrl)

  await prisma.loginToken.delete({ where: { token } }).catch(() => {})

  // ساخت session دیتابیسی (دقیقاً مثل لاگین گوگل)
  const sessionToken = crypto.randomUUID()
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } })

  const isSecure = req.url.startsWith('https')
  const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'

  const res = NextResponse.redirect(new URL('/', req.url))
  res.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    expires,
  })

  return res
}
