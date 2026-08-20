import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // 1. Get the 10 most recent prompts to see what's ACTUALLY in the img field
  const recentPrompts = await prisma.prompt.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { slug: true, titleFa: true, img: true }
  })

  // 2. Count how many prompts have ANY kind of telegram link (broader search)
  const telegramCount = await prisma.prompt.count({
    where: { img: { contains: 'telegram' } } 
  })

  // 3. Count how many have NO image at all
  const noImageCount = await prisma.prompt.count({
    where: { img: null }
  })

  return NextResponse.json({
    ok: true,
    summary: {
      totalPromptsWithAnyTelegramLink: telegramCount,
      totalPromptsWithNoImage: noImageCount,
    },
    recentPrompts: recentPrompts.map(p => ({
      slug: p.slug,
      title: p.titleFa,
      img: p.img,
      hasTelegramLink: p.img?.includes('telegram') || false
    })),
    hint: 'اگر فیلد img خالی است یا لینک داخلی دارد، یعنی اسکریپت ایمپورت، لینک تلگرام را ذخیره نکرده است.'
  })
}
