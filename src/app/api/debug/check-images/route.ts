import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startId = parseInt(searchParams.get('start') || '3660')
  const endId = parseInt(searchParams.get('end') || '3670')

  // Get prompts in range
  const prompts = await prisma.prompt.findMany({
    where: {
      slug: {
        in: Array.from({ length: endId - startId + 1 }, (_, i) => `tg-${startId + i}`)
      }
    },
    select: {
      id: true,
      slug: true,
      titleFa: true,
      img: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const results: any[] = []
  for (const prompt of prompts) {
    const hasImage = !!prompt.img
    const isTelegramUrl = prompt.img?.includes('api.telegram.org')
    
    results.push({
      slug: prompt.slug,
      title: prompt.titleFa,
      hasImage,
      isTelegramUrl,
      imageUrl: prompt.img?.slice(0, 100) + '...',
    })
  }

  const withImages = results.filter(r => r.hasImage).length
  const withoutImages = results.filter(r => !r.hasImage).length

  return NextResponse.json({
    ok: true,
    range: { start: startId, end: endId },
    total: prompts.length,
    withImages,
    withoutImages,
    prompts: results,
    hint: withoutImages > 0 ? 'برخی پرامپت‌ها بدون عکس هستند' : 'همه پرامپت‌ها عکس دارند',
  })
}
