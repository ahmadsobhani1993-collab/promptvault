import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Manually create a page view
    await prisma.pageView.create({
      data: {
        path: '/debug/test',
        referrer: 'manual-test',
        ua: 'test-browser',
        ip: '127.0.0.1',
      }
    })
    
    const count = await prisma.pageView.count()
    
    return NextResponse.json({
      ok: true,
      message: 'Test page view created',
      totalPageViews: count,
    })
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message,
    }, { status: 500 })
  }
}
