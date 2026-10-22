export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchPage, verifyImage } from '@/lib/telegram'
import { GoogleGenerativeAI } from '@google/generative-ai'

const CHANNEL_USERNAME = 'promptsfa1'
const DEFAULT_START_ID = 8143

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

async function analyzePromptWithGemini(rawText: string) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const promptInstructions = `
وظیفه تو استخراج و استانداردسازی پرامپت هوش مصنوعی برای انتشار در یک دایرکتوری تخصصی است.
متن خام تلگرام:
"""
${rawText}
"""

خروجی را الزاما و فقط به صورت یک آبجکت JSON معتبر (بدون تگ های اضافی markdown) برگردان:
{
  "titleFa": "عنوان کاملا توصیفی، صریح و سرچ‌پذیر فارسی بر اساس ماهیت و کارکرد دقیق پرامپت (اصلا تبلیغاتی، استعاری یا کلیشه‌ای نباشد. مثلا: پرامپت افزایش کیفیت عکس / پرامپت پرتره استودیویی تاریک)",
  "descFa": "توضیح کوتاه در حداکثر ۱ تا ۲ خط که صریحا توضیح می‌دهد این پرامپت اگر به ابزار داده شود دقیقا چه تغییری ایجاد می‌کند یا چه تصویری می‌سازد.",
  "promptEn": "پرامپت انگلیسی خالص استخراج شده از متن (بدون آیدی کانال، ایموجی‌های زائد، هشتگ‌ها و متن‌های فارسی)",
  "categorySlug": "یک اسلاگ استاندارد متناسب: photo, portrait, realistic, art, 3d, cinematic, edit, logo"
}
`

  try {
    const result = await model.generateContent(promptInstructions)
    const text = result.response.text().trim().replace(/^```json/, '').replace(/```$/, '').trim()
    return JSON.parse(text)
  } catch (e) {
    console.error('Gemini extraction failed:', e)
    return null
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const limit = body.limit || 5

    // خواندن آخرین آیدی پردازش‌شده از دیتابیس یا شروع از 8143
    const savedSetting = await prisma.setting.findUnique({ where: { key: 'tg_last_imported_id' } })
    let lastId = savedSetting ? parseInt(savedSetting.value, 10) : DEFAULT_START_ID
    if (isNaN(lastId)) lastId = DEFAULT_START_ID

    // دریافت پیام‌های کانال تلگرام
    const messages = await fetchPage(CHANNEL_USERNAME)
    
    // فیلتر کردن پست‌های جدیدتر از آخرین آیدی
    const candidates = messages
      .filter((m) => m.id > lastId && m.img && m.text.trim().length > 30)
      .slice(0, limit)

    if (candidates.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'هیچ پست جدیدی پس از آیدی ' + lastId + ' یافت نشد.',
        lastId,
        processedCount: 0,
        prompts: []
      })
    }

    const processed = []

    for (const msg of candidates) {
      if (!msg.img) continue
      const isImgValid = await verifyImage(msg.img)
      if (!isImgValid) continue

      const analysis = await analyzePromptWithGemini(msg.text)
      if (!analysis || !analysis.promptEn) continue

      // یافتن یا ایجاد دسته‌بندی
      let category = await prisma.category.findFirst({
        where: { slug: analysis.categorySlug || 'general' }
      })
      if (!category) {
        category = await prisma.category.findFirst()
      }

      const slug = `tg-${msg.id}`

      // ثبت در دیتابیس بدون دستکاری بیهوده
      const created = await prisma.prompt.upsert({
        where: { slug },
        update: {
          titleFa: analysis.titleFa,
          descFa: analysis.descFa,
          promptEn: analysis.promptEn,
          img: msg.img,
          status: 'PUBLISHED',
          type: 'IMAGE',
          categoryId: category ? category.id : null,
        },
        create: {
          slug,
          titleFa: analysis.titleFa,
          descFa: analysis.descFa,
          promptEn: analysis.promptEn,
          img: msg.img,
          status: 'PUBLISHED',
          type: 'IMAGE',
          categoryId: category ? category.id : null,
        }
      })

      processed.push({
        id: created.id,
        telegramId: msg.id,
        titleFa: created.titleFa,
        descFa: created.descFa,
        promptEn: created.promptEn,
        img: created.img,
        slug: created.slug
      })

      lastId = Math.max(lastId, msg.id)
    }

    // به‌روزرسانی نشانگر آخرین آیدی پردازش‌شده در دیتابیس
    await prisma.setting.upsert({
      where: { key: 'tg_last_imported_id' },
      update: { value: String(lastId) },
      create: { key: 'tg_last_imported_id', value: String(lastId) }
    })

    return NextResponse.json({
      ok: true,
      lastId,
      processedCount: processed.length,
      prompts: processed
    })

  } catch (error: any) {
    console.error('Batch import error:', error)
    return NextResponse.json({ ok: false, error: String(error?.message ?? error) }, { status: 500 })
  }
}

export async function GET() {
  const savedSetting = await prisma.setting.findUnique({ where: { key: 'tg_last_imported_id' } })
  const lastId = savedSetting ? parseInt(savedSetting.value, 10) : DEFAULT_START_ID
  return NextResponse.json({ ok: true, currentLastId: lastId })
}
