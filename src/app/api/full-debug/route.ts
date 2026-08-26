import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const totalPrompts = await prisma.prompt.count()
  const telegramPrompts = await prisma.prompt.count({ where: { slug: { startsWith: 'tg-' } } })
  const published = await prisma.prompt.count({ where: { status: 'PUBLISHED' } })
  
  const samplePrompts = await prisma.prompt.findMany({
    where: { slug: { startsWith: 'tg-' } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { category: true }
  })
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://promptsfa.ir'

  return NextResponse.json({ 
    ok: true,
    totalPrompts,
    telegramPrompts,
    published,
    samplePrompts: samplePrompts.map(p => ({
      slug: p.slug,
      titleFa: p.titleFa,
      status: p.status,
      categoryName: p.category?.nameFa || 'NULL',
      hasImage: !!p.img,
      url: `${appUrl}/prompts/${p.slug}`
    }))
  })
}
