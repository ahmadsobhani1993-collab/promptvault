export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateText, TAG_VOCAB } from '@/lib/gemini'
import { uploadToCloudinary } from '@/lib/cloudinary'

const DEFAULT_START_ID = 8143
const TARGET_CHANNEL = '@promptsfa1'

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

async function analyzePromptWithGemini(rawText: string) {
  const vocabList = TAG_VOCAB.map((t) => t.fa).join('، ')

  const instruction = `شما یک دستیار فنی سئو برای دایرکتوری پرامپت هوش مصنوعی هستید.
وظیفه شما:
۱. مشخص کنید آیا متن زیر واقعاً یک پرامپت برای تولید تصویر است یا خیر. اگر متن صرفاً خبر، تحلیل، لینک یا احوال‌پرسی کانال است، مقدار "isPrompt": false بگذارید.
۲. اگر پرامپت معتبر است:
   - "titleFa": عنوان کاملا صریح، مستقیم، توصیفی و سرچ‌پذیر فارسی که حتما با "پرامپت " شروع شود. اصلا عنوان زرد، هیجانی یا تبلیغاتی نگذارید. دقیقا بگوید چه تصویری می‌سازد یا چه تغییری روی عکس اعمال می‌کند (مثال: پرامپت افزایش کیفیت عکس / پرامپت تبدیل عکس به انیمه / پرامپت پرتره سینمایی مردانه).
   - "titleEn": عنوان صریح انگلیسی (مانند: Photo Quality Enhancer Prompt).
   - "descFa": توضیح کوتاه در حداکثر ۱ تا ۲ خط که صریحا توضیح می‌دهد ابزار با این پرامپت و تصویر چه کاری انجام می‌دهد.
   - "descEn": توضیح ۱ خطی انگلیسی.
   - "prompt": متن خالص انگلیسی پرامپت بدون متن‌های فارسی، لینک‌ها و منشن‌ها.
   - "model": نام مدل متناسب (Midjourney یا DALL-E 3 یا Stable Diffusion).
   - "tagsFa": ۲ تا ۴ تگ فقط از بین: [${vocabList}].
   - "categorySlug": یک اسلاگ استاندارد متناسب: photo, portrait, realistic, art, 3d, cinematic, edit, logo.

متن ورودی:
"""
${rawText}
"""

پاسخ را الزاما و فقط به صورت یک شیء JSON معتبر (بدون بلاک مارک‌داون) برگردانید:
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

    // ۱. دریافت یا ذخیره chatId کانال
    let chatId = await getSetting('tg_chat_id', '')
    if (!chatId) {
      const c = await (await fetch(api('getChat', { chat_id: TARGET_CHANNEL }))).json()
      if (!c.ok) return NextResponse.json({ ok: false, error: `کانال ${TARGET_CHANNEL} یافت نشد یا بات عضو آن نیست.` }, { status: 500 })
      chatId = String(c.result.id)
      await setSetting('tg_chat_id', chatId)
    }

    // ۲. بررسی چت خصوصی ادمین (برای فوروارد امن پیام)
    const privChat = await getSetting('tg_private_chat', '')
    if (!privChat) {
      return NextResponse.json({
        ok: false,
        error: 'مقدار tg_private_chat در تنظیمات نیست. یک‌بار به بات تلگرام خود استارت (/start) بزنید تا ذخیره شود.',
      }, { status: 400 })
    }

    // ۳. تعیین پوینتر/کرسر
    let cursor = parseInt(await getSetting('tg_last_imported_id', String(DEFAULT_START_ID)), 10)
    if (isNaN(cursor) || cursor < DEFAULT_START_ID) cursor = DEFAULT_START_ID

    const categories = await prisma.category.findMany()
    const processed: any[] = []
    let msgId = cursor
    let scanCount = 0
    const MAX_SCAN = 30

    while (processed.length < limit && scanCount < MAX_SCAN) {
      msgId++
      scanCount++

      try {
        const slug = `tg-${msgId}`
        const exists = await prisma.prompt.findUnique({ where: { slug } })
        if (exists) continue

        // فوروارد پست از کانال به پی‌وی بات
        const f1 = await (await fetch(api('forwardMessage', {
          chat_id: privChat,
          from_chat_id: chatId,
          message_id: String(msgId),
        }))).json()

        if (!f1.ok || !f1.result?.photo) {
          if (f1.description?.includes('MESSAGE_ID_INVALID')) break
          continue
        }

        const photoMsg = f1.result
        const fwd1 = photoMsg.message_id
        let raw = (photoMsg.caption || '').trim()
        let fwd2: number | null = null

        // اگر پیام عکس زیرنویس کوتاه داشت، پیام بعدی را فوروارد و بررسی می‌کنیم
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
            if (!nm.photo && txt.length > 30) {
              raw = txt
              msgId++ // اسکیپ پیام بعدی به دلیل ادغام
            }
          }
        }

        // پاک کردن پیام‌های فوروارد شده در پی‌وی
        for (const id of [fwd1, fwd2]) {
          if (id) await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(id) })).catch(() => {})
        }

        raw = cleanText(raw)
        if (raw.length < 15) continue

        // ارزیابی با جمینای
        const ai = await analyzePromptWithGemini(raw)
        if (!ai || !ai.isPrompt || !ai.prompt) continue

        // دریافت فایل عکس و آپلود در Cloudinary
        const fileId = photoMsg.photo[photoMsg.photo.length - 1].file_id
        const gf = await (await fetch(api('getFile', { file_id: fileId }))).json()
        if (!gf.ok) continue

        const imgBuf = Buffer.from(await (await fetch(`https://api.telegram.org/file/bot${token}/${gf.result.file_path}`)).arrayBuffer())
        const up = await uploadToCloudinary(imgBuf, 'promptsfa/prompts')

        const cat = categories.find((c) => c.slug === ai.categorySlug) || categories[0]
        const rawTags = Array.isArray(ai.tagsFa) ? ai.tagsFa : []
        const tagsFa = rawTags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 4)
        const tagsEn = tagsFa.map((fa: string) => {
          const item = TAG_VOCAB.find((v) => v.fa === fa)
          return item ? item.en : 'art'
        })

        const promptData = {
          titleFa: ai.titleFa.startsWith('پرامپت') ? ai.titleFa : `پرامپت ${ai.titleFa}`,
          titleEn: ai.titleEn || 'AI Prompt',
          descFa: ai.descFa || '',
          descEn: ai.descEn || '',
          prompt: ai.prompt,
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
          create: { slug, ...promptData },
        })

        await prisma.promptImage.upsert({
          where: { promptId: created.id },
          update: { data: up.publicId, type: 'cloudinary' },
          create: { promptId: created.id, data: up.publicId, type: 'cloudinary' },
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
      } catch (err) {
        console.error(`خطا در پردازش پیام ${msgId}:`, err)
      }
    }

    await setSetting('tg_last_imported_id', String(msgId))

    return NextResponse.json({
      ok: true,
      lastId: msgId,
      processedCount: processed.length,
      prompts: processed,
    })
  } catch (error: any) {
    console.error('[Batch Import Server Error]:', error)
    return NextResponse.json({ ok: false, error: String(error?.message ?? error) }, { status: 500 })
  }
}

export async function GET() {
  const lastId = parseInt(await getSetting('tg_last_imported_id', String(DEFAULT_START_ID)), 10)
  return NextResponse.json({ ok: true, currentLastId: lastId })
}
