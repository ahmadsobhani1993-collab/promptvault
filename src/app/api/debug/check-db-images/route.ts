import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    // Get ALL prompts - simple query
    const allPrompts = await prisma.prompt.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: { slug: true, titleFa: true, img: true }
    })

    // Manual check for telegram links
    const telegramLinks = allPrompts.filter(p => p.img && p.img.includes('telegram'))
    const nullImages = allPrompts.filter(p => p.img === null)
    const otherImages = allPrompts.filter(p => p.img && !p.img.includes('telegram'))

    return NextResponse.json({
      ok: true,
      total: allPrompts.length,
      withTelegramLinks: telegramLinks.length,
      withNullImages: nullImages.length,
      withOtherImages: otherImages.length,
      samples: {
        telegram: telegramLinks.slice(0, 3),
        null: nullImages.slice(0, 3),
        other: otherImages.slice(0, 3),
      },
      hint: telegramLinks.length === 0 
        ? 'هیچ لینک تلگرامی در دیتابیس نیست. ایمپورت باید لینک تلگرام ذخیره کند.'
        : 'لینک‌های تلگرامی وجود دارند',
    })
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message,
      hint: 'خطا در دسترسی به دیتابیس',
    })
  }
}
