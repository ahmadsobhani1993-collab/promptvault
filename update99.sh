#!/bin/bash
set -e

cat > src/app/api/cron/article/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'
import { qwenGenerate } from '@/lib/qwen'
import { buildDailySchedule } from '@/lib/schedule'
import { tgSendText } from '@/lib/telegram'

export const maxDuration = 60
const APP = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'

const IMAGE_MODELS = [
  process.env.TOKENROUTER_IMAGE_MODEL || '',
  'gemini/gemini-2.5-flash-image-preview-free',
  'qwen/qwen-image-free',
  'black-forest-labs/flux.1-schnell-free',
].filter(Boolean)

async function genImage(promptEn: string): Promise<{ url: string; via: string }> {
  const key = process.env.TOKENROUTER_API_KEY
  if (key) {
    for (const model of IMAGE_MODELS) {
      try {
        const res = await fetch('https://api.tokenrouter.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
          body: JSON.stringify({ model, prompt: promptEn, n: 1, size: '1024x1024' }),
          signal: AbortSignal.timeout(40000),
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
            const up = await (await fetch('https://api.telegram.org/bot' + token + '/sendPhoto', { method: 'POST', body: form, signal: AbortSignal.timeout(25000) })).json()
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
    via: 'pollinations-fallback',
  }
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const schedule = await buildDailySchedule().catch(() => null)

  const instruction =
    'تو یک نویسنده حرفه‌ای و متخصص سئو برای وب‌سایت فارسی آموزش هوش مصنوعی هستی.\n' +
    'یک مقاله آموزشی کامل و یکتا درباره یکی از موضوعات داغ آموزش هوش مصنوعی بنویس (هر بار موضوع متفاوت: پرامپت‌نویسی، ابزارهای AI، تولید تصویر، ویدیو با AI، کدنویسی با AI، موسیقی با AI و...).\n' +
    'الزامات سئو: کلمه کلیدی اصلی را در عنوان، توضیح متا، اولین پاراگراف و چند زیرعنوان بیاور. عنوان زیر ۶۰ کاراکتر. توضیح متا زیر ۱۶۰ کاراکتر و جذاب.\n' +
    'مقاله حداقل ۸۰۰ کلمه، با زیرعنوان‌های ## و لیست‌ها و مثال عملی.\n' +
    'فقط و فقط یک JSON معتبر برگردان (بدون markdown) با کلیدهای دقیق:\n' +
    '{"keywordFa","keywordsFa":[5],"titleFa","slugEn","metaDescFa","descFa","contentFa","imagePromptEn"}\n' +
    '- slugEn: lowercase english hyphenated.\n' +
    '- imagePromptEn: detailed english prompt for a futuristic cover image about the topic.'

  let raw = ''
  try {
    raw = await qwenGenerate(instruction)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'qwen: ' + String(e?.message ?? e) }, { status: 500 })
  }

  const m = raw.match(/\{[\s\S]*\}/)
  let a: any = {}
  try { a = m ? JSON.parse(m[0]) : {} } catch { return NextResponse.json({ ok: false, error: 'bad json', raw: raw.slice(0, 300) }, { status: 500 }) }

  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date())
  const slug = String(a.slugEn || 'ai-education').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + date
  const titleFa = String(a.titleFa || 'آموزش هوش مصنوعی')
  const metaDescFa = String(a.metaDescFa || a.descFa || titleFa)
  const contentFa = String(a.contentFa || '')
  const keywordFa = String(a.keywordFa || 'هوش مصنوعی')

  const image = await genImage(String(a.imagePromptEn || 'futuristic artificial intelligence education concept, golden dark theme'))

  let article: any = null
  try {
    article = await prisma.article.create({
      data: {
        titleFa,
        titleEn: titleFa,
        descFa: metaDescFa,
        descEn: metaDescFa,
        contentFa,
        contentEn: contentFa,
        img: image.url,
        tagFa: keywordFa,
        tagEn: keywordFa,
        slug,
      },
    })
  } catch {
    article = await prisma.article.create({
      data: { titleFa, titleEn: titleFa, descFa: metaDescFa, descEn: metaDescFa, img: image.url, tagFa: keywordFa, tagEn: keywordFa, slug },
    }).catch(() => null)
  }

  if (!article) return NextResponse.json({ ok: false, error: 'article create failed' }, { status: 500 })

  // send to channel in Tehran day window
  const hour = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: 'numeric', hour12: false }).format(new Date()), 10)
  let tg: any = null
  const out = process.env.TELEGRAM_OUTPUT
  if (out && hour >= 12 && hour <= 23) {
    tg = await tgSendText(out, '📚 ' + titleFa + '\n\n🔑 ' + keywordFa + '\n\n🔗 ' + APP() + '/blog/' + slug).catch(() => null)
  }

  return NextResponse.json({ ok: true, slug, imageVia: image.via, keywords: a.keywordsFa ?? [], schedule, tg })
}
EOF

echo "✅ update99 done! (article = 100% Qwen)"