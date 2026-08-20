import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startId = parseInt(searchParams.get('start') || '3660')
  const endId = parseInt(searchParams.get('end') || '3670')
  const batchSize = parseInt(searchParams.get('batch') || '5')

  // Get prompts without images
  const prompts = await prisma.prompt.findMany({
    where: {
      slug: {
        in: Array.from({ length: endId - startId + 1 }, (_, i) => `tg-${startId + i}`)
      },
      img: null,
    },
    select: { id: true, slug: true, titleFa: true },
    take: batchSize,
  })

  if (prompts.length === 0) {
    return NextResponse.json({
      ok: true,
      message: 'No prompts without images in this range',
    })
  }

  return NextResponse.json({
    ok: true,
    found: prompts.length,
    prompts: prompts.map(p => ({
      slug: p.slug,
      title: p.titleFa,
      fixUrl: `https://promptsfa.ir/api/debug/fix-missing-images?key=pv-cron-8x2m1q&slug=${p.slug}`,
    })),
    hint: `برای修复 هر پرامپت، روی fixUrl کلیک کنید`,
  })
}
