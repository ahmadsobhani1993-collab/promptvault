#!/bin/bash
set -e

cat > src/app/api/cron/article/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'
import { generateText } from '@/lib/gemini'
import { buildDailySchedule } from '@/lib/schedule'
import { tgSendText } from '@/lib/telegram'

export const maxDuration = 60
const APP = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'

const IMAGE_MODELS = [
  process.env.TOKENROUTER_IMAGE_MODEL || '',
  'bytedance-seed/seedream-5.0-lite',
  'google/gemini-3.1-flash-lite-image',
  'openai/gpt-5-image-mini',
].filter(Boolean)

async function getSetting(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}
async function setSetting(k: string, v: string) {
  await prisma.setting.upsert({ where: { key: k }, update: { value: v }, create: { key: k, value: v } })
}

const INSTRUCTION =
  'تو یک نویسنده حرفه‌ای و متخصص سئو برای وب‌سایت فارسی آموزش هوش مصنوعی هستی.\n' +
  'یک مقاله آموزشی کامل و یکتا درباره یکی از موضوعات داغ آموزش هوش مصنوعی بنویس (هر بار موضوع متفاوت: پرامپت‌نویسی، ابزارهای AI، تولید تصویر، ویدیو با AI، کدنویسی با AI، موسیقی با AI و...).\n' +
  'الزامات سئو: کلمه کلیدی اصلی را در عنوان، توضیح متا، اولین پاراگراف و چند زیرعنوان بیاور. عنوان زیر ۶۰ کاراکتر. توضیح متا زیر ۱۶۰ کاراکتر و جذاب.\n' +
  'مقاله حداقل ۸۰۰ کلمه، با زیرعنوان‌های ## و لیست‌ها و مثال عملی.\n' +
  'فقط و فقط یک JSON معتبر برگردان (بدون markdown) با کلیدهای دقیق:\n' +
  '{"keywordFa","keywordsFa":[5],"titleFa","slugEn","metaDescFa","descFa","contentFa","imagePromptEn"}\n' +
  '- slugEn: lowercase english hyphenated.\n' +
  '- imagePromptEn: detailed english prompt for a futuristic cover image about the topic.'

async function genImageFast(promptEn: string): Promise<{ url: string; via: string }> {
  const key = process.env.TOKENROUTER_API_KEY
  const started = Date.now()
  if (key) {
    for (const model of IMAGE_MODELS) {
      if (Date.now() - started > 20000) break
      try {
        const res = await fetch('https://api.tokenrouter.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
          body: JSON.stringify({ model, prompt: promptEn, n: 1, size: '1024x1024' }),
          signal: AbortSignal.timeout(12000),
        })
        if (!res.ok) continue
        const j = await res.json()
        const d = j?.data?.[0]
        if (d?.url) return { url: d.url, via: model }
        if (d?.b64_json) {
          const storage = (await prisma.setting.findUnique({ where: { key: 'tg_storage_chat' } }))?.value
          const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
          if (storage && token) {
            const buf = Buffer.from(d.b64_json, 'base64')
            const form = new FormData()
            form.append('chat_id', storage)
            form.append('photo', new Blob([new Uint8Array(buf)], { type: 'image/png' }), 'cover.png')
            const up = await (await fetch('https://api.telegram.org/bot' + token + '/sendPhoto', { method: 'POST', body: form, signal: AbortSignal.timeout(20000) })).json()
            const fid = up?.result?.photo?.[up.result.photo.length - 1]?.file_id
            if (fid) {
              const row = await prisma.uploadImage.create({ data: { fileId: fid } })
              return { url: APP() + '/api/img/' + row.id, via: model + ' (vault)' }
            }
          }
        }
      } catch {}
    }
  }
  return {
    url: 'https://image.pollinations.ai/prompt/' + encodeURIComponent(promptEn) + '?width=1200&height=630&nologo=true',
    via: 'pollinations',
  }
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key') ?? ''
  const step = searchParams.get('step') ?? '1'

  if (step === '1') {
    const schedule = await buildDailySchedule().catch(() => null)
    let raw = ''
    let err = ''
    try { raw = (await generateText({ instruction: INSTRUCTION })).text } catch (e: any) { err = String(e?.message ?? e) }
    if (!raw) return NextResponse.json({ ok: false, error: 'text gen failed: ' + err, schedule })

    await setSetting('article_draft', JSON.stringify({ raw }))
    fetch(APP() + '/api/cron/article?key=' + key + '&step=2', { signal: AbortSignal.timeout(6000) }).catch(() => {})
    return NextResponse.json({ ok: true, phase: 'text-done', chained: true, schedule })
  }

  // ---------- STEP 2 ----------
  const draftRaw = await getSetting('article_draft', '')
  if (!draftRaw) return NextResponse.json({ ok: false, error: 'no draft' }, { status: 400 })
  let raw = ''
  try { raw = JSON.parse(draftRaw).raw } catch {}
  if (!raw) return NextResponse.json({ ok: false, error: 'bad draft' }, { status: 400 })

  const m = raw.match(/\{[\s\S]*\}/)
  let a: any = {}
  try { a = m ? JSON.parse(m[0]) : {} } catch { return NextResponse.json({ ok: false, error: 'bad json', raw: raw.slice(0, 300) }, { status: 500 }) }

  const now = new Date()
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now)
  const dateFa = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'long', day: 'numeric' }).format(now)
  const dateEn = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'long', day: 'numeric' }).format(now)
  const slugBase = String(a.slugEn || 'ai-education').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const slug = slugBase + '-' + date + '-' + Math.random().toString(36).slice(2, 6)
  const titleFa = String(a.titleFa || 'آموزش هوش مصنوعی')
  const titleEn = String(a.titleEn || titleFa)
  const metaDescFa = String(a.metaDescFa || a.descFa || titleFa)
  const metaDescEn = String(a.metaDescEn || a.descEn || metaDescFa)
  const contentFa = String(a.contentFa || '')
  const contentEn = String(a.contentEn || contentFa)
  const keywordFa = String(a.keywordFa || 'هوش مصنوعی')
  const keywordEn = String(a.keywordEn || keywordFa)
  const readFa = '۵ دقیقه مطالعه'
  const readEn = '5 min read'

  const image = await genImageFast(String(a.imagePromptEn || 'futuristic artificial intelligence education concept, golden dark theme'))

  let article: any = null
  let lastErr = ''
  try {
    article = await prisma.article.create({
      data: {
        slug,
        titleFa,
        titleEn,
        descFa: metaDescFa,
        descEn: metaDescEn,
        img: image.url,
        tagFa: keywordFa,
        tagEn: keywordEn,
        dateFa,
        dateEn,
        readFa,
        readEn,
        contentFa,
        contentEn,
      },
    })
  } catch (e: any) {
    lastErr = String(e?.message ?? e)
  }

  if (!article) return NextResponse.json({ ok: false, error: 'article create failed', prismaError: lastErr.slice(-600), imageVia: image.via }, { status: 500 })

  const hour = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: 'numeric', hour12: false }).format(new Date()), 10)
  let tg: any = null
  const out = process.env.TELEGRAM_OUTPUT
  if (out && hour >= 12 && hour <= 23) {
    tg = await tgSendText(out, '📚 ' + titleFa + '\n\n🔑 ' + keywordFa + '\n\n🔗 ' + APP() + '/blog/' + slug).catch(() => null)
  }

  return NextResponse.json({ ok: true, slug, imageVia: image.via, keywords: a.keywordsFa ?? [], tg })
}
EOF

echo "✅ article route: full rewrite with all required fields"