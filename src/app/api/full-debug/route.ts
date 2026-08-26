import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const checks: any = {}

  // 1. بررسی تعداد پرامپت‌ها
  checks.totalPrompts = await prisma.prompt.count()
  checks.telegramPrompts = await prisma.prompt.count({ where: { slug: { startsWith: 'tg-' } } })
  
  // 2. بررسی وضعیت publish
  checks.published = await prisma.prompt.count({ where: { status: 'PUBLISHED' } })
  checks.pending = await prisma.prompt.count({ where: { status: 'PENDING' } })
  
  // 3. بررسی دسته‌بندی
  checks.withCategory = await prisma.prompt.count({ where: { categoryId: { not: null } } })
  checks.withoutCategory = await prisma.prompt.count({ where: { categoryId: null } })
  
  // 4. بررسی عکس
  checks.withImage = await prisma.prompt.count({ where: { img: { not: '' } } })
  checks.withoutImage = await prisma.prompt.count({ where: { img: '' } })
  
  // 5. نمونه پرامپت‌ها
  const samplePrompts = await prisma.prompt.findMany({
    where: { slug: { startsWith: 'tg-' } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { category: true }
  })
  
  checks.samplePrompts = samplePrompts.map(p => ({
    slug: p.slug,
    titleFa: p.titleFa,
    status: p.status,
    categoryId: p.categoryId,
    categoryName: p.category?.nameFa || 'NULL',
    img: p.img?.substring(0, 80) || 'EMPTY',
    hasPrompt: !!p.prompt,
    promptLength: p.prompt?.length || 0,
  }))
  
  // 6. بررسی RLS
  try {
    const rlsCheck = await prisma.$queryRaw`SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'Prompt'`
    checks.rlsStatus = rlsCheck
  } catch (e: any) {
    checks.rlsError = e.message
  }
  
  // 7. بررسی لینک image-proxy
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://promptsfa.ir'
  checks.imageProxyTest = `${appUrl}/api/image-proxy?url=https://api.telegram.org/file/bot7007876498:AAEOd87f_PMo-Efv7bhHVYviZ1GZwjF2wOA/photos/file_0.jpg`
  
  // 8. بررسی صفحه detail
  checks.detailPageExample = `${appUrl}/prompts/tg-2`
  
  // 9. تنظیمات تلگرام
  const settings = await prisma.setting.findMany({
    where: { key: { in: ['tg_chat_id', 'import_cursor_msg_id', 'tg_private_chat'] } }
  })
  checks.telegramSettings = settings

  return NextResponse.json({ ok: true, checks })
}
