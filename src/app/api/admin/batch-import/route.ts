export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateText, TAG_VOCAB } from '@/lib/gemini'
import { uploadToCloudinary } from '@/lib/cloudinary'

const DEFAULT_START_ID = 8143
const TARGET_CHANNEL = 'promptsfa1'

async function getSetting(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}

async function setSetting(k: string, v: string) {
  await prisma.setting.upsert({ where: { key: k }, update: { value: v }, create: { key: k, value: v } })
}

function cleanText(t: string): string {
  return t
    .replace(/@[\w]+/g, '')
    .replace(/✨[^\n]*✨/g, '')
    .replace(/\(?[^)\n]*پرامپت در پیام بعد[^)\n]*\)?/g, '')
    .replace(/کانال پرامپت ذخیره/g, '')
    .replace(/پرامپت هوشمند/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function generateCleanSlug(titleEn: string, msgId: number): string {
  const base = (titleEn || 'ai-prompt')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
  return `${base || 'ai-prompt'}-${msgId}`
}

async function analyzePromptWithGemini(rawText: string) {
  const vocabList = TAG_VOCAB.map((t) => t.fa).join('، ')

  const instruction = `شما یک متخصص سئو و پرامپت انجینیر هستید.
وظیفه:
۱. تشخیص دهید آیا متن زیر شامل پرامپت یا دستور ساخت تصویر با هوش مصنوعی هست یا نه. (تنها در صورتی که خبر، اطلاعیه، چت خالی و نامرتبط باشد isPrompt=false دهید).
۲. استخراج اطلاعات سئومحور و دقیق:
   - "titleFa": عنوان کاملاً صریح، بدون کلمات زرد و تبلیغاتی، که مستقیماً بگوید چه تصویری تولید می‌شود یا چه ادیتی رخ می‌دهد و حتماً با "پرامپت " شروع شود (مثال: پرامپت پرتره سینمایی مردانه / پرامپت افزایش کیفیت چهره).
   - "titleEn": عنوان کوتاه و صریح انگلیسی مناسب برای URL Slug (مثال: Cinematic Male Portrait Prompt / Photo Quality Enhancer).
   - "descFa": متادیسکریپشن دقیق و سئوشده فارسی در ۱ الی ۲ خط صریح که کاربرد پرامپت و نتیجه تصویر را توضیح دهد.
   - "descEn": Meta description in English (1 sentence).
   - "prompt": متن انگلیسی خالص پرامپت (حذف آیدی کانال، لینک‌ها و ایموجی‌ها).
   - "model": نام هوش مصنوعی مرتبط (Midjourney, DALL-E 3, Stable Diffusion, AI).
   - "tagsFa": ۲ تا ۴ تگ فارسی دقیق از: [${vocabList}].
   - "categorySlug": یکی از این اسلاگ‌ها: photo, portrait, realistic, art, 3d, cinematic, edit, logo.

متن ورودی:
"""
${rawText}
"""

پاسخ را فقط و فقط به صورت JSON معتبر زیر بازگردانید:
{
  "isPrompt": true,
  "titleFa": "...",
  "titleEn": "...",
  "descFa": "...",
  "descEn": "...",
  "prompt": "...",
  "model": "Midjourney",
  "tagsFa": ["..."],
  "categorySlug": "photo"
}`

  try {
    const { text } = await generateText({
      instruction,
      expectJson: true,
      temperature: 0.1,
      timeoutMs: 25000,
    })
    const cleaned = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()
    const m = cleaned.match(/\{[\s\S]*\}/)
    return JSON.parse(m ? m[0] : cleaned)
  } catch (err) {
    console.error('[Gemini Analyze Error]:', err)
    return null
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const limit = Math.min(5, body.limit || 3)

    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN تنظیم نشده است' }, { status: 500 })

    const api = (m: string, p?: Record<string, string>) =>
      `https://api.telegram.org/bot${token}/${m}${p ? '?' + new URLSearchParams(p) : ''}`

    // ۱. دریافت آیدی عددی کانال promptsfa1
    let channelUsername = TARGET_CHANNEL.startsWith('@') ? TARGET_CHANNEL : `@${TARGET_CHANNEL}`
    let chatId = await getSetting('tg_chat_id_v2', '')
    if (!chatId) {
      const c = await (await fetch(api('getChat', { chat_id: channelUsername }))).json()
      if (!c.ok) return NextResponse.json({ ok: false, error: `کانال ${channelUsername} یافت نشد یا بات عضو آن نیست: ${c.description}` }, { status: 500 })
      chatId = String(c.result.id)
      await setSetting('tg_chat_id_v2', chatId)
    }

    // ۲. بررسی چت اختصاصی برای دریافت فوروارد
    let privChat = await getSetting('tg_private_chat', '')
    if (!privChat) {
      return NextResponse.json({
        ok: false,
        error: 'مقدار tg_private_chat یافت نشد. لطفاً یک پیام /start به بات در تلگرام ارسال کنید.',
      }, { status: 400 })
    }

    // ۳. تعیین پوینتر آخرین پست بررسی‌شده
    let cursor = parseInt(await getSetting('tg_last_imported_id', String(DEFAULT_START_ID)), 10)
    if (isNaN(cursor) || cursor < DEFAULT_START_ID) cursor = DEFAULT_START_ID

    const categories = await prisma.category.findMany()
    const processed: any[] = []
    const debugLogs: any[] = []
    let msgId = cursor
    let scanCount = 0
    const MAX_SCAN = 40

    while (processed.length < limit && scanCount < MAX_SCAN) {
      msgId++
      scanCount++

      try {
        // ۱. فوروارد عکس پست از کانال به ربات
        const f1 = await (await fetch(api('forwardMessage', {
          chat_id: privChat,
          from_chat_id: chatId,
          message_id: String(msgId),
        }))).json()

        if (!f1.ok) {
          debugLogs.push({ msgId, status: 'forward_fail', err: f1.description })
          if (f1.description?.includes('MESSAGE_ID_INVALID')) break
          continue
        }

        const photoMsg = f1.result
        const fwd1 = photoMsg.message_id
        const hasPhoto = Boolean(photoMsg.photo && photoMsg.photo.length > 0)

        if (!hasPhoto) {
          debugLogs.push({ msgId, status: 'no_photo' })
          await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(fwd1) })).catch(() => {})
          continue
        }

        let raw = (photoMsg.caption || '').trim()
        let fwd2: number | null = null

        // ۲. اگر زیرنویس عکس کوتاه بود یا به پیام بعد اشاره داشت، پیام بعدی را بررسی می‌کنیم
        if (raw.length < 50 || raw.includes('👇') || raw.includes('پیام بعد') || raw.includes('پیام زیر')) {
          const f2 = await (await fetch(api('forwardMessage', {
            chat_id: privChat,
            from_chat_id: chatId,
            message_id: String(msgId + 1),
          }))).json()

          if (f2.ok && f2.result) {
            const nm = f2.result
            fwd2 = nm.message_id
            const txt = (nm.text || nm.caption || '').trim()
            if (!nm.photo && txt.length > 15) {
              raw = txt
              msgId++ // ادغام شد، پس پست بعدی اسکیپ می‌شود
            }
          }
        }

        // حذف پیام‌های فورواردشده از صفحه شخصی ربات
        for (const id of [fwd1, fwd2]) {
          if (id) await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(id) })).catch(() => {})
        }

        raw = cleanText(raw)
        if (raw.length < 10) {
          debugLogs.push({ msgId, status: 'too_short' })
          continue
        }

        // ۳. بررسی و تحلیل پرامپت با جمینای
        const ai = await analyzePromptWithGemini(raw)
        if (!ai || !ai.isPrompt || !ai.prompt) {
          debugLogs.push({ msgId, status: 'skipped_not_prompt', text: raw.slice(0, 60) })
          continue
        }

        // ۴. دانلود مستقیم تصویر تلگرام و آپلود به آبجکت‌استوریج ابر آروان
        const fileId = photoMsg.photo[photoMsg.photo.length - 1].file_id
        const gf = await (await fetch(api('getFile', { file_id: fileId }))).json()
        if (!gf.ok) {
          debugLogs.push({ msgId, status: 'getFile_error' })
          continue
        }

        const imgBuf = Buffer.from(await (await fetch(`https://api.telegram.org/file/bot${token}/${gf.result.file_path}`)).arrayBuffer())
        const up = await uploadToCloudinary(imgBuf, 'promptsfa/prompts')

        // ۵. ساخت اسلاگ انگلیسی، متادیسکریپشن و ذخیره در دیتابیس
        const slug = generateCleanSlug(ai.titleEn, msgId)
        const cat = categories.find((c) => c.slug === ai.categorySlug) || categories[0]
        const rawTags = Array.isArray(ai.tagsFa) ? ai.tagsFa : []
        const tagsFa = rawTags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 4)
        const tagsEn = tagsFa.map((fa: string) => {
          const item = TAG_VOCAB.find((v) => v.fa === fa)
          return item ? item.en : 'art'
        })

        const titleFa = ai.titleFa.startsWith('پرامپت') ? ai.titleFa : `پرامپت ${ai.titleFa}`
        const descFa = ai.descFa || `${titleFa} - دریافت پرامپت متنی و اجرای سریع در ابزارهای هوش مصنوعی.`

        const promptData = {
          slug,
          titleFa,
          titleEn: ai.titleEn || 'AI Prompt',
          descFa,
          descEn: ai.descEn || '',
          prompt: ai.prompt.trim(),
          img: up.url,
          model: ai.model || (/--v\s?\d|--ar|midjourney/i.test(ai.prompt) ? 'Midjourney' : 'DALL-E 3'),
          status: 'PUBLISHED' as const,
          type: 'IMAGE' as const,
          categoryId: cat.id,
          tagsFa: tagsFa.length > 0 ? tagsFa : ['پرتره'],
          tagsEn: tagsEn.length > 0 ? tagsEn : ['portrait'],
        }

        const created = await prisma.prompt.upsert({
          where: { slug },
          update: promptData,
          create: promptData,
        })

        await prisma.promptImage.upsert({
          where: { promptId: created.id },
          update: { data: up.publicId, type: 'arvan' },
          create: { promptId: created.id, data: up.publicId, type: 'arvan' },
        }).catch(() => {})

        processed.push({
          id: created.id,
          telegramId: msgId,
          titleFa: created.titleFa,
          descFa: created.descFa,
          promptEn: created.prompt,
          img: created.img,
          slug: created.slug,
        })
      } catch (err: any) {
        debugLogs.push({ msgId, status: 'error', error: err.message })
      }
    }

    await setSetting('tg_last_imported_id', String(msgId))

    return NextResponse.json({
      ok: true,
      lastId: msgId,
      processedCount: processed.length,
      prompts: processed,
      debugLogs,
    })
  } catch (error: any) {
    console.error('[Batch Import Error]:', error)
    return NextResponse.json({ ok: false, error: String(error?.message ?? error) }, { status: 500 })
  }
}

export async function GET() {
  const lastId = parseInt(await getSetting('tg_last_imported_id', String(DEFAULT_START_ID)), 10)
  return NextResponse.json({ ok: true, currentLastId: lastId })
}
