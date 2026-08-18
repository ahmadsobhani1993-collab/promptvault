import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'
import { generateText } from '@/lib/gemini'

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
  'تو یک استراتژیست سئو و کپی‌رایتر ارشد فارسی‌زبان هستی؛ متخصص رتبه‌آوری در گوگل فارسی.\n' +
  'هدف: مقاله‌ای بنویس که برای کلمه کلیدی اصلی رتبه 1 گوگل بگیرد و کاربر را تا انتها نگه دارد.\n' +
  'اصول الزامی:\n' +
  '1) کلمه کلیدی اصلی (keywordFa) + 6 کلمه کلیدی هم‌معنی/LSI (keywordsFa).\n' +
  '2) عنوان (titleFa): زیر 60 کاراکتر، شامل کلمه کلیدی + عدد + کلمه قدرتمند (راهنمای کامل، بهترین روش‌ها، از صفر تا صد).\n' +
  '3) metaDescFa: بین 140 تا 155 کاراکتر، شامل کلمه کلیدی + مزیت + دعوت به اقدام.\n' +
  '4) مقدمه 3-4 جمله با فرمول PAS: درد کاربر + تشدید + وعده راه‌حل؛ کلمه کلیدی در جمله اول.\n' +
  '5) بدنه حداقل 1200 کلمه با این ساختار دقیق:\n' +
  '   ## [کلمه کلیدی] چیست؟ (تعریف ساده + بولد کلمه کلیدی)\n' +
  '   ## چرا [هم‌معنی کلید] مهم است (3 مزیت با لیست)\n' +
  '   ## آموزش گام‌به‌گام (5+ گام با زیرعنوان ### و یک مثال عملی واقعی در هر گام)\n' +
  '   ## بهترین ابزارها (معرفی 4 ابزار + لینک داخلی به /explore)\n' +
  '   ## اشتباهات رایج (لیست 4 موردی)\n' +
  '   ## پرسش‌های متداول (4 سوال با پاسخ 2-3 جمله‌ای برای featured snippet)\n' +
  '   ## جمع‌بندی (تکرار طبیعی کلیدی + CTA به /explore)\n' +
  '6) کلمات LSI طبیعی پخش شوند (چگالی 1-2%)؛ عبارات مهم **بولد**؛ در صورت امکان یک جدول مقایسه‌ای.\n' +
  '7) جملات زیر 20 کلمه؛ پاراگراف‌ها حداکثر 4 خط؛ لحن صمیمیِ متخصص؛ بدون غلط املایی.\n' +
  '8) دو لینک داخلی مارک‌داون: [پرامپت‌های آماده هوش مصنوعی](/explore) و [دسته‌بندی‌ها](/categories).\n' +
  'فقط و فقط یک JSON معتبر برگردان با کلیدهای دقیق:\n' +
  '{"keywordFa","keywordEn","keywordsFa":[6],"titleFa","titleEn","slugEn","metaDescFa","descFa","contentFa","imagePromptEn"}\n' +
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
  const force = searchParams.get('force') === '1'

  if (step === '1') {
    const schedule = { built: false }
    const todayStart = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date()) + 'T00:00:00+03:30')
    const todayCount = await prisma.article.count({ where: { createdAt: { gte: todayStart } } })
    if (!force && todayCount > 0) return NextResponse.json({ ok: true, skipped: 'article exists today', schedule })
    let raw = ''
    let err = ''
    const recent = await prisma.article.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { titleFa: true, tagFa: true } })
    const recentTopics = recent.map((r) => r.titleFa).join('، ')
    const instruction = INSTRUCTION + '\n9) موضوعاتی که قبلاً پوشش داده شده و تکرارشان ممنوع است: ' + recentTopics + '\n10) موضوع جدید باید کاملاً متفاوت از لیست بالا باشد.'
    try { raw = (await generateText({ instruction })).text } catch (e: any) { err = String(e?.message ?? e) }
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
        contentFa: contentFa.split(/\n{1,2}/).map((x: string) => x.trim()).filter(Boolean),
        contentEn: contentEn.split(/\n{1,2}/).map((x: string) => x.trim()).filter(Boolean),
        status: 'PENDING',
      },
    })
  } catch (e: any) {
    lastErr = String(e?.message ?? e)
  }

  if (!article) return NextResponse.json({ ok: false, error: 'article create failed', prismaError: lastErr.slice(-600), imageVia: image.via }, { status: 500 })

    const tg = null

  return NextResponse.json({ ok: true, slug, imageVia: image.via, keywords: a.keywordsFa ?? [], tg })
}
