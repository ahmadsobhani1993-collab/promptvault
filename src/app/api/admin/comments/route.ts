import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { id, action } = await req.json()
  if (action === 'delete') {
    await prisma.comment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'bad action' }, { status: 400 })
}
