import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // فقط type و promptId را بخوان (بدون data سنگین)
  const images = await prisma.promptImage.findMany({
    select: { promptId: true, type: true },
  })

  const typeCounts: Record<string, number> = {}
  for (const img of images) {
    const t = img.type ?? 'null'
    typeCounts[t] = (typeCounts[t] || 0) + 1
  }

  // حالا فقط آن‌هایی که احتمالاً base64 دارند را چک کن (data سنگین)
  // base64 با "data:" شروع می‌شود و type معمولاً cloudinary یا null است
  let base64Count = 0
  let base64Mb = 0
  let sampleSlug: string | null = null

  const candidates = await prisma.promptImage.findMany({
    where: {
      OR: [
        { type: null },
        { type: 'base64' },
        { type: { not: 'cloudinary' } },
      ],
    },
    select: { promptId: true, type: true, data: true, prompt: { select: { slug: true } } },
    take: 500, // محدود کن تا egress زیاد نشود
  })

  for (const img of candidates) {
    const len = (img.data || '').length
    if (img.data?.startsWith('data:')) {
      base64Count++
      base64Mb += len / 1024 / 1024
      if (!sampleSlug) sampleSlug = img.prompt.slug
    }
  }

  return NextResponse.json({
    ok: true,
    total_images: images.length,
    by_type: typeCounts,
    base64_found: base64Count,
    base64_mb_sampled: base64Mb.toFixed(2),
    estimated_total_base64_mb: candidates.length < images.length
      ? `حداقل ${base64Mb.toFixed(1)}MB (فقط ${candidates.length} نمونه اسکن شد)`
      : `${base64Mb.toFixed(1)}MB (همه اسکن شدند)`,
    sample_slug: sampleSlug,
    verdict: base64Count > 0
      ? `⚠️ ${base64Count} تصویر base64 قدیمی پیدا شد → این عامل اصلی مصرف egress است`
      : '✅ هیچ base64 قدیمی نیست → مشکل از query های صفحه explore است',
  })
}
