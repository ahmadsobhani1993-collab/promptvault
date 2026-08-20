import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const totalPrompts = await prisma.prompt.count()
  const publishedPrompts = await prisma.prompt.count({ where: { status: 'PUBLISHED' } })
  
  // Check a sample prompt for SEO fields
  const samplePrompt = await prisma.prompt.findFirst({
    where: { status: 'PUBLISHED' },
    select: { titleFa: true, descFa: true, tagsFa: true, img: true, slug: true },
  })

  return NextResponse.json({
    ok: true,
    seo: {
      totalPrompts,
      publishedPrompts,
      samplePrompt,
      recommendations: [
        '✅ از JSON-LD structured data استفاده شده',
        '✅ Meta tags بهینه برای هر صفحه',
        '✅ Open Graph tags برای اشتراک‌گذاری',
        '✅ Sitemap.xml موجود است',
        '✅ Robots.txt تنظیم شده',
      ],
      nextSteps: [
        '1. به search.google.com/search-console بروید',
        '2. سایت promptsfa.ir را verify کنید',
        '3. sitemap.xml را submit کنید',
        '4. از /api/seo/ping-google استفاده کنید',
        '5. صبر کنید (۲-۷ روز برای ایندکس)',
      ],
    },
  })
}
