import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { signIn } from '@/auth'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  const loginToken = await prisma.loginToken.findUnique({ where: { token } })
  if (!loginToken || loginToken.status !== 'APPROVED' || !loginToken.telegramId) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const user = await prisma.user.findUnique({ where: { telegramId: loginToken.telegramId } })
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  await prisma.loginToken.delete({ where: { token } })

  await signIn('telegram', { userId: user.id, redirect: false })

  return NextResponse.redirect(new URL('/', req.url))
}
