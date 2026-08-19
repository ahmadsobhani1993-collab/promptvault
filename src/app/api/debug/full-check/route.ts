import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    
    const result: any = {
      authenticated: !!session?.user,
      userId: session?.user?.id,
      email: session?.user?.email,
    }

    if (!session?.user) {
      return NextResponse.json(result)
    }

    const userId = session.user.id

    // Check all user activities
    const [likes, saves, prompts, comments, pageViews] = await Promise.all([
      prisma.like.findMany({ 
        where: { userId }, 
        include: { prompt: { select: { titleFa: true, slug: true } } },
        take: 10
      })),
      prisma.save.findMany({ 
        where: { userId }, 
        include: { prompt: { select: { titleFa: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.prompt.findMany({ 
        where: { userId },
        select: { titleFa: true, slug: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.comment.findMany({ 
        where: { userId },
        include: { prompt: { select: { titleFa: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.pageView.count(),
    ])

    result.activity = {
      likes: { count: likes.length, items: likes },
      saves: { count: saves.length, items: saves },
      prompts: { count: prompts.length, items: prompts },
      comments: { count: comments.length, items: comments },
      totalPageViews: pageViews,
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('❌ Full-check error:', err)
    return NextResponse.json({
      error: err.message,
      stack: err.stack,
    }, { status: 500 })
  }
}
