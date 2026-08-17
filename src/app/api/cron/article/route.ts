import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyImage, tgSendText } from '@/lib/telegram'
import { isCronAuthorized } from '@/lib/cron-auth'
import { generateText } from '@/lib/gemini'

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
  const p = encodeURIComponent(kw + ', award-winning digital art, cinematic dark luxury style, golden light accents, ultra detailed, 8k, sharp focus, no text, no watermark')
  const raw = 'https://image.pollinations.ai/prompt/' + p + '?model=flux&width=1280&height=720&seed=' + seed + '&nologo=true'
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
    'You are a Persian tech educator. Write a COMPLETE long-form article of at least 1200 words in Persian. Write an engaging educational article about: "' + topic.fa + '".\n' +
    'Return ONLY valid JSON (no markdown) with keys:\n' +
    '"titleFa","titleEn","descFa","descEn","introFa","sections","conclusionFa","tagsFa"\n' +
    '- sections: array of 5 objects {"hFa","pFa"} where pFa is 6-8 friendly practical sentences.\n' +
    '- introFa: 2-3 sentences hook. conclusionFa: 2-3 sentences.\n' +
    '- tagsFa: max 3 from: پرتره، محصول، سینمایی، فانتزی، انیمه، واقع‌گرایانه، مینیمال، لوکس، تاریک، نئون، طبیعت، معماری، کاراکتر، لوگو، پوستر، تبلیغات، آموزش، کد، نویسندگی، بهره‌وری، موسیقی، ویدیو، عکاسی، سه‌بعدی، رنگی'

  let raw = ''
  try {
    raw = (await generateText({ instruction })).text
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 })
  }
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
    if (i === 1 || i === 3) {
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
      dateFa: new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'long' }).format(new Date()),
      dateEn: today,
      readFa: Math.max(2, Math.ceil((bodyHtml.length / 1500))) + ' دقیقه مطالعه',
      readEn: '5 min read',
      contentFa: [bodyHtml],
      contentEn: [bodyHtml],
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
