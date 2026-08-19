import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
    }

    const userId = session.user.id

    // Simple count without any orderBy
    const saveCount = await prisma.save.count({ where: { userId } })
    
    // Get all saves without orderBy
    const saves = await prisma.save.findMany({
      where: { userId },
      select: {
        id: true,
        promptId: true,
      }
    })

    return NextResponse.json({
      userId,
      saveCount,
      saves,
    })
  } catch (err: any) {
    console.error(' Save check error:', err)
    return NextResponse.json({
      error: err.message,
    }, { status: 500 })
  }
}
