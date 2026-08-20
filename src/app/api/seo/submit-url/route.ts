import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')

  if (!url) {
    // Get latest 10 prompts
    const prompts = await prisma.prompt.findMany({
      select: { slug: true, titleFa: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({
      ok: true,
      message: 'برای ایندکس سریع‌تر، این URLها را در Google Search Console ثبت کنید:',
      urls: prompts.map(p => `https://promptsfa.ir/prompts/${p.slug}`),
      hint: 'یا از ?url=https://promptsfa.ir/prompts/slug استفاده کنید',
    })
  }

  // Note: Google Indexing API requires OAuth and is for job posting/video only
  // But we can still ping via sitemap
  return NextResponse.json({
    ok: true,
    url,
    message: 'برای ایندکس این صفحه:',
    steps: [
      '1. به Google Search Console بروید',
      `2. در بخش URL Inspection، این آدرس را وارد کنید: ${url}`,
      '3. روی "Request Indexing" کلیک کنید',
    ],
    alternative: 'از /api/seo/ping-google استفاده کنید تا sitemap را به گوگل معرفی کنید',
  })
}
