export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchPage, verifyImage } from '@/lib/telegram'
import { generateText, TAG_VOCAB } from '@/lib/gemini'

const CHANNEL_USERNAME = 'promptsfa1'
const DEFAULT_START_ID = 8143

async function analyzePromptForDirectory(rawText: string) {
  const vocabList = TAG_VOCAB.map((t) => t.fa).join('، ')

  const instruction = `شما یک دستیار فنی استخراج پرامپت هوش مصنوعی هستید.
متن خام دریافت شده از تلگرام:
"""
${rawText}
"""

خروجی را دقیقا و الزاما فقط به صورت یک آبجکت JSON معتبر (بدون تگ های اضافی و بدون هیچ مارک‌داونی) برگردانید:
{
  "titleFa": "عنوان کاملا توصیفی، صریح و سرچ‌پذیر فارسی بر اساس ماهیت دقیق پرامپت. حتما با کلمه 'پرامپت ' شروع شود. اصلا تبلیغاتی نباشد (مثال: پرامپت افزایش کیفیت عکس / پرامپت پرتره سینمایی مردانه)",
  "titleEn": "A direct descriptive English title (e.g. Photo Quality Enhancer Prompt / Cinematic Male Portrait Prompt)",
  "descFa": "توضیح کوتاه در ۱ تا ۲ خط که صریحا توضیح می‌دهد این پرامپت دقیقا چه تغییری در خروجی می‌دهد و چه کاری انجام می‌دهد.",
  "descEn": "Short 1-2 sentence description explaining what the prompt does.",
  "prompt": "متن خالص و کامل انگلیسی پرامپت (بدون آیدی کانال، ایموجی‌ها، متن‌های فارسی و لینک‌ها)",
  "model": "نام مدل هوش مصنوعی مرتبط (مثلا: Midjourney یا DALL-E 3 یا Stable Diffusion)",
  "tagsFa": ["۲ تا ۴ تگ مرتبط به فارسی فقط از این لیست: ${vocabList}"],
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

    // خواندن آخرین آیدی ثبت‌شده یا شروع از 8143
    const savedSetting = await prisma.setting.findUnique({ where: { key: 'tg_last_imported_id' } })
    let lastId = savedSetting ? parseInt(savedSetting.value, 10) : DEFAULT_START_ID
    if (isNaN(lastId)) lastId = DEFAULT_START_ID

    const messages = await fetchPage(CHANNEL_USERNAME)

    const candidates = messages
      .filter((m) => m.id > lastId && m.img && m.text.trim().length > 10)
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
      if (!analysis || !analysis.prompt) continue

      // دریافت دسته‌بندی معتبر از دیتابیس
      let category = await prisma.category.findFirst({
        where: { slug: analysis.categorySlug || 'photo' },
      })
      if (!category) {
        category = await prisma.category.findFirst()
      }
      if (!category) continue

      const slug = `tg-${msg.id}`
      const baseTitle = String(analysis.titleFa || 'پرامپت هوش مصنوعی').trim()
      const titleFa = baseTitle.startsWith('پرامپت') ? baseTitle : `پرامپت ${baseTitle}`
      const titleEn = String(analysis.titleEn || 'AI Prompt').trim()
      const descFa = String(analysis.descFa || '').trim()
      const descEn = String(analysis.descEn || '').trim()
      const promptContent = String(analysis.prompt).trim()
      const aiModel = String(analysis.model || 'Midjourney').trim()

      const rawTags = Array.isArray(analysis.tagsFa) ? analysis.tagsFa : []
      const tagsFa = rawTags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 4)
      const tagsEn = tagsFa.map((fa: string) => {
        const item = TAG_VOCAB.find((v) => v.fa === fa)
        return item ? item.en : 'art'
      })

      // دقیقاً مطابق مدل Prompt در اسکیمای دیتابیس
      const promptData = {
        titleFa,
        titleEn,
        descFa,
        descEn,
        prompt: promptContent,
        img: msg.img,
        model: aiModel,
        status: 'PUBLISHED' as const,
        type: 'IMAGE' as const,
        categoryId: category.id,
        tagsFa: tagsFa.length > 0 ? tagsFa : ['پرتره'],
        tagsEn: tagsEn.length > 0 ? tagsEn : ['portrait'],
      }

      const created = await prisma.prompt.upsert({
        where: { slug },
        update: promptData,
        create: {
          slug,
          ...promptData,
        },
      })

      processed.push({
        id: created.id,
        telegramId: msg.id,
        titleFa: created.titleFa,
        descFa: created.descFa,
        promptEn: created.prompt,
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