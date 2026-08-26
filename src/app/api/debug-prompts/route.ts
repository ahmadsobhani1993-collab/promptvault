import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // بررسی ۱۰ پرامپت آخر تلگرام
  const prompts = await prisma.prompt.findMany({
    where: { slug: { startsWith: 'tg-' } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { category: true }
  })

  // بررسی وضعیت کلی
  const stats = {
    total: await prisma.prompt.count({ where: { slug: { startsWith: 'tg-' } } }),
    published: await prisma.prompt.count({ where: { slug: { startsWith: 'tg-' }, status: 'PUBLISHED' } }),
    pending: await prisma.prompt.count({ where: { slug: { startsWith: 'tg-' }, status: 'PENDING' } }),
    noCategory: await prisma.prompt.count({ where: { slug: { startsWith: 'tg-' }, categoryId: null } }),
    noImg: await prisma.prompt.count({ where: { slug: { startsWith: 'tg-' }, img: '' } }),
  }

  return NextResponse.json({
    stats,
    samplePrompts: prompts.map(p => ({
      slug: p.slug,
      titleFa: p.titleFa,
      status: p.status,
      categoryId: p.categoryId,
      categoryName: p.category?.nameFa,
      img: p.img?.substring(0, 50),
      hasPrompt: !!p.prompt,
      promptLength: p.prompt?.length || 0,
    }))
  })
}
