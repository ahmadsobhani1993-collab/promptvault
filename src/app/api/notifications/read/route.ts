import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  await prisma.notification.updateMany({ where: { userId: session.user.id, read: false }, data: { read: true } })
  return NextResponse.json({ ok: true })
}
