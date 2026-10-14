import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
      return NextResponse.json({ session: null, liked: false, saved: false })
    }

    const item = await prisma.prompt.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!item) {
      return NextResponse.json({ session: { userId }, liked: false, saved: false })
    }

    const [liked, saved] = await Promise.all([
      prisma.like.findUnique({
        where: { userId_promptId: { userId, promptId: item.id } },
        select: { id: true },
      }),
      prisma.save.findUnique({
        where: { userId_promptId: { userId, promptId: item.id } },
        select: { id: true },
      }),
    ])

    return NextResponse.json({
      session: { userId },
      liked: !!liked,
      saved: !!saved,
    })
  } catch (error) {
    return NextResponse.json({ session: null, liked: false, saved: false }, { status: 500 })
  }
}