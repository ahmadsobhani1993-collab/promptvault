import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ items: [] })

  try {
    const items = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, text: true, url: true, createdAt: true },
    })
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ items: [] })
  }
}