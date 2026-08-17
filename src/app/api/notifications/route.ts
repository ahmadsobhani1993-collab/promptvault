import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ items: [], unread: 0 })

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: 'desc' }, take: 15 }),
    prisma.notification.count({ where: { userId: session.user.id, read: false } }),
  ])

  return NextResponse.json({
    items: items.map((n) => ({
      id: n.id,
      text: n.text,
      url: n.url,
      read: n.read,
      createdAt: new Date(n.createdAt).toLocaleString('fa-IR'),
    })),
    unread,
  })
}
