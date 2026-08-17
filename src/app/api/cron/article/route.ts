import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyImage, tgSendText } from '@/lib/telegram'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60

const TOPICS = [
  { fa: 'میدجرنی چیست؟ راهنمای کامل شروع', kw: 'midjourney ai art gallery futuristic dark' },
  { fa: 'هوش مصنوعی مولد چیست؟ به زبان ساده', kw: 'generative ai neural network abstract golden' },
  { fa: 'بهترین هوش مصنوعی‌های تولید تصویر در ۲۰۲۶', kw: 'ai image generation tools hologram collage' },
  { fa: 'پرامپت‌نویسی حرفه‌ای: از صفر تا صد', kw: 'prompt engineering holographic keyboard dark' },
  { fa: 'بهترین هوش مصنوعی‌های تولید ویدیو', kw: 'ai video generation cinematic camera neon' },
  { fa: 'LoRA و فاین‌تیون چیست؟', kw: 'ai model training gpu chips dark lab' },
  { fa: 'مقایسه فلاکس و میدجرنی', kw: 'two ai robots art duel cinematic' },
  { fa: 'هوش مصنوعی در تولید محتوای اینستاگرام', kw: 'social media content creator ai phone glow' },
  { fa: 'افزایش کیفیت تصویر با هوش مصنوعی', kw: 'photo enhancement upscaling pixels macro' },
  { fa: 'کپی‌رایت و اخلاق در هنر هوش مصنوعی', kw: 'ai art copyright justice scales dark gold' },
]

function pollUrl(kw: string, seed: number) {
  const p = encodeURIComponent(kw + ', cinematic dark luxury style, golden light accents, ultra detailed, no text, no watermark')
  const raw = 'https://image.pollinations.ai/prompt/' + p + '?width=1200&height=675&seed=' + seed + '&nologo=true'
  return 'https://wsrv.nl/?url=' + encodeURIComponent(raw) + '&w=1200&q=80&output=jpg'
}

function tehranDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date())
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const today = tehranDate()
  const last = await prisma.setting.findUnique({ where: { key: 'article_last_date' } })
  if (last?.value === today && new URL(req.url).searchParams.get('force') !== '1') {
    return NextResponse.json({ ok: true, msg: 'today article already published' })
  }

  const dayIndex = Math.floor(new Date(today).getTime() / 86400000)
  const topic = TOPICS[dayIndex % TOPICS.length]

  const instruction =
    'You are a Persian tech educator. Write an engaging educational article about: "' + topic.fa + '".\n' +
    'Return ONLY valid JSON (no markdown) with keys:\n' +
    '"titleFa","titleEn","descFa","descEn","introFa","sections","conclusionFa","tagsFa"\n' +
    '- sections: array of 3-4 objects {"hFa","pFa"} where pFa is 3-5 friendly practical sentences.\n' +
    '- introFa: 2-3 sentences hook. conclusionFa: 2-3 sentences.\n' +
    '- tagsFa: max 3 from: پرتره، محصول، سینمایی، فانتزی، انیمه، واقع‌گرایانه، مینیمال، لوکس، تاریک، نئون، طبیعت، معماری، کاراکتر، لوگو، پوستر، تبلیغات، آموزش، کد، نویسندگی، بهره‌وری، موسیقی، ویدیو، عکاسی، سه‌بعدی، رنگی'

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + (process.env.GEMINI_MODEL || 'gemini-2.5-flash') + ':generateContent?key=' + process.env.GEMINI_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: instruction }] }] }),
      signal: AbortSignal.timeout(30000),
    }
  )
  const rbody = await res.text()
  if (!res.ok) return NextResponse.json({ ok: false, error: 'Gemini HTTP ' + res.status + ' :: ' + rbody.slice(0, 250) }, { status: 500 })
  const json = JSON.parse(rbody)
  const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return NextResponse.json({ ok: false, error: 'no json from gemini' }, { status: 500 })
  let a: any
  try {
    a = JSON.parse(m[0])
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json from gemini', raw: raw.slice(0, 300) }, { status: 500 })
  }

  let cover = pollUrl(topic.kw, dayIndex)
  if (!(await verifyImage(cover))) cover = pollUrl(topic.kw, dayIndex + 7)
  if (!(await verifyImage(cover))) cover = 'https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=1200&auto=format&fit=crop'

  const related = await prisma.prompt.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { stars: 'desc' },
    take: 3,
    select: { slug: true, titleFa: true },
  })

  let bodyHtml = '<p>' + (a.introFa ?? '') + '</p>'
  bodyHtml += '<img src="' + cover + '" alt="' + (a.titleFa ?? topic.fa) + '" loading="lazy" />'
  const sections = Array.isArray(a.sections) ? a.sections.slice(0, 4) : []
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i]
    bodyHtml += '<h2>' + (sec.hFa ?? '') + '</h2><p>' + (sec.pFa ?? '') + '</p>'
    if (i === 1) {
      const secImg = pollUrl(topic.kw + ' variation ' + i, dayIndex + i * 13)
      if (await verifyImage(secImg)) bodyHtml += '<img src="' + secImg + '" alt="' + (sec.hFa ?? '') + '" loading="lazy" />'
    }
  }
  bodyHtml += '<h2>جمع‌بندی</h2><p>' + (a.conclusionFa ?? '') + '</p>'
  if (related.length) {
    bodyHtml += '<h2>✨ پرامپت‌های پیشنهادی</h2>'
    for (const r of related) bodyHtml += '<p>• <a href="/prompts/' + r.slug + '">' + r.titleFa + '</a></p>'
  }

  const slug = 'auto-' + today

  await prisma.article.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      titleFa: a.titleFa ?? topic.fa,
      titleEn: a.titleEn ?? topic.fa,
      descFa: a.descFa ?? '',
      descEn: a.descEn ?? '',
      img: cover,
      tagFa: (a.tagsFa ?? ['آموزش'])[0] ?? 'آموزش',
      tagEn: 'tutorial',
      contentFa: bodyHtml,
    } as any,
  })

  await prisma.setting.upsert({
    where: { key: 'article_last_date' },
    update: { value: today },
    create: { key: 'article_last_date', value: today },
  })

  const out = process.env.TELEGRAM_OUTPUT
  const hour = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: 'numeric', hour12: false }).format(new Date()), 10)
  let tg = false
  if (out && process.env.TELEGRAM_BOT_TOKEN && hour >= 12 && hour <= 23) {
    tg = await tgSendText(out, '📚 ' + (a.titleFa ?? topic.fa) + '\n' + (process.env.NEXT_PUBLIC_APP_URL ?? '') + '/blog/' + slug)
  }

  return NextResponse.json({ ok: true, slug, title: a.titleFa, tg })
}
