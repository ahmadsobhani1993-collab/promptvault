import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  const { searchParams } = new URL(req.url)
  const start = parseInt(searchParams.get('start') || '2', 10)
  const end = parseInt(searchParams.get('end') || '50', 10)
  
  const missingIds: number[] = []
  const existingIds: number[] = []
  const notFoundIds: number[] = []

  for (let msgId = start; msgId <= end; msgId++) {
    const existing = await prisma.prompt.findUnique({ 
      where: { slug: `tg-${msgId}` } 
    })
    
    if (existing) {
      existingIds.push(msgId)
    } else {
      missingIds.push(msgId)
    }
  }

  return NextResponse.json({
    range: { start, end },
    summary: {
      total: end - start + 1,
      existing: existingIds.length,
      missing: missingIds.length,
    },
    missingIds,
    existingIds: existingIds.length < 20 ? existingIds : `...(${existingIds.length} items)`,
  })
}
