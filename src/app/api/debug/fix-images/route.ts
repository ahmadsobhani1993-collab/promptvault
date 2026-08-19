import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const articles = await prisma.article.findMany({
    select: { id: true, titleFa: true, img: true },
  })

  const broken: any[] = []
  const fixed: any[] = []

  for (const a of articles) {
    // Check if image URL is broken
    if (!a.img || a.img.includes('undefined') || a.img.includes('null')) {
      broken.push({ id: a.id, title: a.titleFa, img: a.img })
      continue
    }

    // Try to fetch the image
    try {
      const res = await fetch(a.img, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
      if (!res.ok) {
        broken.push({ id: a.id, title: a.titleFa, img: a.img, status: res.status })
      }
    } catch (err: any) {
      broken.push({ id: a.id, title: a.titleFa, img: a.img, error: err.message })
    }
  }

  return NextResponse.json({
    ok: true,
    total: articles.length,
    brokenCount: broken.length,
    broken: broken.slice(0, 10), // Show first 10
    hint: 'برای مقالات با عکس شکسته، باید عکس جدید آپلود کنید یا لینک را اصلاح کنید',
  })
}
