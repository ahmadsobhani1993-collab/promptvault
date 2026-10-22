export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchPage, verifyImage } from '@/lib/telegram'
import { generateText, TAG_VOCAB } from '@/lib/gemini'

const CHANNEL_USERNAME = 'promptsfa1'
const DEFAULT_START_ID = 8143

interface ParsedPromptAnalysis {
  isPrompt: boolean
  titleFa?: string
  titleEn?: string
  descFa?: string
  descEn?: string
  prompt?: string
  model?: string
  categorySlug?: string
  tagsFa?: string[]
}

async function analyzePromptWithGemini(rawText: string): Promise<ParsedPromptAnalysis | null> {
  const vocabList = TAG_VOCAB.map((t) => t.fa).join('، ')

  const instruction = `شما یک پالایشگر فنی پرامپت‌های هوش مصنوعی هستید.
وظیفه شما:
۱. مشخص کنید آیا متن زیر واقعاً یک دستور یا پرامپت هوش مصنوعی (برای تصویرسازی یا مدل‌های هوش مصنوعی) است یا نه (اگر متن صرفاً خبر، احوال‌پرسی، تحلیل یا تبلیغات کانال است، مقدار "isPrompt" باید false باشد).
۲. اگر پرامپت است، عنوان کاملاً سرچ‌پذیر و صریح، توضیح ۱ الی ۲ خطی شفاف، متن خالص انگلیسی، مدل و تگ‌ها را برگردانید.

متن ورودی:
"""
${rawText}
"""

پاسخ را دقیقاً در قالب این JSON برگردانید (بدون مارک‌داون و بدون هیچ متن اضافه):
{
  "isPrompt": true,
  "titleFa": "عنوان کاملا توصیفی، صریح و سرچ‌پذیر فارسی بر اساس خروجی پرامپت که حتما با 'پرامپت ' شروع شود و اصلا تبلیغاتی نباشد (مثال: پرامپت افزایش کیفیت عکس / پرامپت پرتره سینمایی مردانه)",
  "titleEn": "A direct, descriptive English title (e.g. Photo Quality Enhancer Prompt / Cinematic Male Portrait Prompt)",
  "descFa": "توضیح کوتاه در حداکثر ۱ تا ۲ خط که صریحا می‌گوید اگر عکس یا پرامپت داده شود خروجی دقیقا چه خواهد بود.",
  "descEn": "Short 1-2 sentence description explaining exactly what this prompt produces.",
  "prompt": "متن خالص انگلیسی پرامپت (حذف آیدی‌های تلگرام، لینک‌ها، ایموجی‌های زائد و جملات فارسی)",
  "model": "نام مدل (مثلا Midjourney یا DALL-E 3)",
  "categorySlug": "یک اسلاگ استاندارد متناسب: photo, portrait, realistic, art, 3d, cinematic, edit, logo",
  "tagsFa": ["۲ تا ۴ تگ از بین: ${vocabList}"]
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
    console.error('[Gemini Filter] Failed:', err)
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

    // دریافت لیست پیام‌های کانال
    const messages = await fetchPage(CHANNEL_USERNAME)

    // سورت صعودی برای رعایت توالی پیام‌ها
    const newMessages = messages
      .filter((m) => m.id > lastId)
      .sort((a, b) => a.id - b.id)

    if (newMessages.length === 0) {
      return NextResponse.json({
        ok: true,
        message: `پیام جدیدی پس از آیدی ${lastId} پیدا نشد.`,
        lastId,
        processedCount: 0,
        prompts: [],
      })
    }

    const processed = []
    let pendingImg: string | null = null
    let maxSeenId = lastId

    for (let i = 0; i < newMessages.length; i++) {
      if (processed.length >= limit) break

      const current = newMessages[i]
      maxSeenId = Math.max(maxSeenId, current.id)
      const textTrim = (current.text || '').trim()
      const hasImage = Boolean(current.img)

      // حالت ۱: پیام عکس دارد
      if (hasImage) {
        // آیا متن کوتاهی دارد که یعنی پرامپت در پیام بعدی است؟
        const isFollowupPointer = textTrim.length < 35 || textTrim.includes('👇') || textTrim.includes('پیام زیر')

        if (isFollowupPointer) {
          // عکس را نگه می‌داریم و منتظر پیام بعدی می‌مانیم
          pendingImg = current.img
          continue
        } else {
          // عکس دارد و متنش هم به اندازه کافی بلند است که خودش پرامپت باشد
          pendingImg = null
          const analysis = await analyzePromptWithGemini(textTrim)
          if (!analysis || !analysis.isPrompt || !analysis.prompt) continue

          const savedItem = await savePromptRecord(current.id, current.img, analysis)
          if (savedItem) processed.push(savedItem)
        }
      } 
      // حالت ۲: پیام فقط متن است (عکس ندارد)
      else if (textTrim.length > 0) {
        const targetImage = pendingImg // اگر از پیام قبلی عکسی در صف بود

        const analysis = await analyzePromptWithGemini(textTrim)
        // اگر خبر، چت یا متن نامربوط بود
        if (!analysis || !analysis.isPrompt || !analysis.prompt) {
          pendingImg = null // ریست عکس در صف
          continue
        }

        // اگر عکسی از پیام قبلی بود، با آن ترکیب می‌شود
        const imgToUse = targetImage || ''
        if (imgToUse) {
          const isImgValid = await verifyImage(imgToUse)
          if (isImgValid) {
            const savedItem = await savePromptRecord(current.id, imgToUse, analysis)
            if (savedItem) processed.push(savedItem)
          }
        }
        pendingImg = null
      }
    }

    // به‌روزرسانی آخرین آیدی در دیتابیس
    await prisma.setting.upsert({
      where: { key: 'tg_last_imported_id' },
      update: { value: String(maxSeenId) },
      create: { key: 'tg_last_imported_id', value: String(maxSeenId) },
    })

    return NextResponse.json({
      ok: true,
      lastId: maxSeenId,
      processedCount: processed.length,
      prompts: processed,
    })
  } catch (error: any) {
    console.error('[Batch Import] Server error:', error)
    return NextResponse.json({ ok: false, error: String(error?.message ?? error) }, { status: 500 })
  }
}

async function savePromptRecord(tgId: number, imgUrl: string, analysis: ParsedPromptAnalysis) {
  try {
    let category = await prisma.category.findFirst({
      where: { slug: analysis.categorySlug || 'photo' },
    })
    if (!category) {
      category = await prisma.category.findFirst()
    }
    if (!category) return null

    const slug = `tg-${tgId}`
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

    const promptData = {
      titleFa,
      titleEn,
      descFa,
      descEn,
      prompt: promptContent,
      img: imgUrl,
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
      create: { slug, ...promptData },
    })

    return {
      id: created.id,
      telegramId: tgId,
      titleFa: created.titleFa,
      descFa: created.descFa,
      promptEn: created.prompt,
      img: created.img,
      slug: created.slug,
    }
  } catch (e) {
    console.error('Error saving prompt record:', e)
    return null
  }
}

export async function GET() {
  const savedSetting = await prisma.setting.findUnique({ where: { key: 'tg_last_imported_id' } })
  const lastId = savedSetting ? parseInt(savedSetting.value, 10) : DEFAULT_START_ID
  return NextResponse.json({ ok: true, currentLastId: lastId })
}
