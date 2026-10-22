export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchPage, verifyImage } from '@/lib/telegram'
import { generateText } from '@/lib/gemini'

const CHANNEL_USERNAME = 'promptsfa1'
const DEFAULT_START_ID = 8143

async function analyzePromptForDirectory(rawText: string) {
  const instruction = `شما یک دستیار فنی استخراج پرامپت هوش مصنوعی هستید.
متن خام دریافت شده از کانال تلگرام:
"""
${rawText}
"""

خروجی را الزاما و فقط به صورت یک شیء JSON معتبر (بدون بلاک مارک‌داون و بدون هیچ متن اضافه) برگردانید با این مشخصات:
{
  "titleFa": "عنوان کاملا توصیفی، صریح و سرچ‌پذیر فارسی بر اساس ماهیت دقیق پرامپت. حتما با کلمه 'پرامپت ' شروع شود. اصلا تبلیغاتی، استعاری یا جذاب نباشد. دقیقا بگوید چه چیزی تولید می‌کند یا چه تغییری در تصویر می‌دهد (مثال: پرامپت افزایش کیفیت عکس، پرامپت پرتره سینمایی مردانه، پرامپت تبدیل عکس به کارتون، پرامپت طراحی لوگو مینیمال)",
  "descFa": "توضیح کوتاه در حداکثر ۱ تا ۲ خط که صریحا توضیح می‌دهد اگر عکس یا این پرامپت را به هوش مصنوعی بدهند، دقیقا چه تغییری در خروجی می‌دهد و چه کاری انجام می‌دهد.",
  "promptEn": "متن انگلیسی پرامپت به صورت خالص، بدون آیدی کانال، ایموجی‌ها، متن‌های فارسی و لینک‌ها",
  "categorySlug": "یک اسلاگ استاندارد متناسب: photo, portrait, realistic, art, 3d, cinematic, edit, logo"
}`

  try {
    const { text } = await generateText({
      instruction,
      expectJson: true,
      temperature: 0.2,
      timeoutMs: 30000,
    })

    const cleaned = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()
    const m = cleaned.match(/\{[\s\S]*\}/)
    return JSON.parse(m ? m[0] : cleaned)
  } catch (err) {
    console.error('[Gemini Import] Analyze failed:', err)
    return null
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const limit = body.limit || 5

    const savedSetting = await prisma.setting.findUnique({ where: { key: 'tg_last_imported_id' } })
    let lastId = savedSetting ? parseInt(savedSetting.value, 10) : DEFAULT_START_ID
    if (isNaN(lastId)) lastId = DEFAULT_START_ID

    const messages = await fetchPage(CHANNEL_USERNAME)

    const candidates = messages
      .filter((m) => m.id > lastId && m.img && m.text.trim().length > 25)
      .slice(0, limit)

    if (candidates.length === 0) {
      return NextResponse.json({
        ok: true,
        message: `پست جدیدی پس از آیدی ${lastId} یافت نشد.`,
        lastId,
        processedCount: 0,
        prompts: [],
      })
    }

    const processed = []

    for (const msg of candidates) {
      if (!msg.img) continue
      const isImgValid = await verifyImage(msg.img)
      if (!isImgValid) continue

      const analysis = await analyzePromptForDirectory(msg.text)
      if (!analysis || !analysis.promptEn) continue

      let category = await prisma.category.findFirst({
        where: { slug: analysis.categorySlug || 'photo' },
      })
      if (!category) {
        category = await prisma.category.findFirst()
      }

      const slug = `tg-${msg.id}`
      const baseTitle = String(analysis.titleFa || 'پرامپت هوش مصنوعی').trim()
      const titleFa = baseTitle.startsWith('پرامپت') ? baseTitle : `پرامپت ${baseTitle}`

      const created = await prisma.prompt.upsert({
        where: { slug },
        update: {
          titleFa,
          descFa: String(analysis.descFa || '').trim(),
          promptEn: String(analysis.promptEn).trim(),
          promptFa: msg.text,
          img: msg.img,
          status: 'PUBLISHED',
          type: 'IMAGE',
          categoryId: category ? category.id : null,
        },
        create: {
          slug,
          titleFa,
          descFa: String(analysis.descFa || '').trim(),
          promptEn: String(analysis.promptEn).trim(),
          promptFa: msg.text,
          img: msg.img,
          status: 'PUBLISHED',
          type: 'IMAGE',
          categoryId: category ? category.id : null,
        },
      })

      processed.push({
        id: created.id,
        telegramId: msg.id,
        titleFa: created.titleFa,
        descFa: created.descFa,
        promptEn: created.promptEn,
        img: created.img,
        slug: created.slug,
      })

      lastId = Math.max(lastId, msg.id)
    }

    await prisma.setting.upsert({
      where: { key: 'tg_last_imported_id' },
      update: { value: String(lastId) },
      create: { key: 'tg_last_imported_id', value: String(lastId) },
    })

    return NextResponse.json({
      ok: true,
      lastId,
      processedCount: processed.length,
      prompts: processed,
    })
  } catch (error: any) {
    console.error('[Batch Import] Server error:', error)
    return NextResponse.json({ ok: false, error: String(error?.message ?? error) }, { status: 500 })
  }
}

export async function GET() {
  const savedSetting = await prisma.setting.findUnique({ where: { key: 'tg_last_imported_id' } })
  const lastId = savedSetting ? parseInt(savedSetting.value, 10) : DEFAULT_START_ID
  return NextResponse.json({ ok: true, currentLastId: lastId })
}