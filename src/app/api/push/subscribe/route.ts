import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { endpoint, keys } = await req.json()
  if (!endpoint || !keys) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { keys: JSON.stringify(keys) },
    create: { endpoint, keys: JSON.stringify(keys), userId: session.user.id },
  })

  return NextResponse.json({ ok: true })
}
