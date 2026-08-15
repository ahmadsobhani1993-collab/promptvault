#!/bin/bash
set -e

cat > src/lib/gemini.ts << 'EOF'
export const TAG_VOCAB: { fa: string; en: string }[] = [
  { fa: 'پرتره', en: 'portrait' },
  { fa: 'محصول', en: 'product' },
  { fa: 'سینمایی', en: 'cinematic' },
  { fa: 'فانتزی', en: 'fantasy' },
  { fa: 'انیمه', en: 'anime' },
  { fa: 'واقع‌گرایانه', en: 'photorealistic' },
  { fa: 'مینیمال', en: 'minimal' },
  { fa: 'لوکس', en: 'luxury' },
  { fa: 'تاریک', en: 'dark' },
  { fa: 'نئون', en: 'neon' },
  { fa: 'طبیعت', en: 'nature' },
  { fa: 'معماری', en: 'architecture' },
  { fa: 'کاراکتر', en: 'character' },
  { fa: 'لوگو', en: 'logo' },
  { fa: 'پوستر', en: 'poster' },
  { fa: 'تبلیغات', en: 'ads' },
  { fa: 'آموزش', en: 'tutorial' },
  { fa: 'کد', en: 'code' },
  { fa: 'نویسندگی', en: 'writing' },
  { fa: 'بهره‌وری', en: 'productivity' },
  { fa: 'موسیقی', en: 'music' },
  { fa: 'ویدیو', en: 'video' },
  { fa: 'عکاسی', en: 'photography' },
  { fa: 'سه‌بعدی', en: '3d' },
  { fa: 'رنگی', en: 'colorful' },
]

export type GeminiResult = {
  titleFa: string
  titleEn: string
  descFa: string
  descEn: string
  usageFa: string
  usageEn: string
  categorySlug: string
  tagsFa: string[]
  tagsEn: string[]
}

export async function analyzeWithGemini(opts: {
  text: string
  imgBase64: string | null
  categories: { slug: string; fa: string; en: string }[]
}): Promise<GeminiResult> {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite'

  const instruction =
    'You are an AI prompt curator. Read the given AI prompt (and image if provided). ' +
    'Return ONLY a valid JSON object (no markdown) with exactly these keys:\n' +
    '"titleFa","titleEn","descFa","descEn","usageFa","usageEn","categorySlug","tagsFa","tagsEn"\n' +
    '- titleFa/titleEn: short catchy title (fa/en).\n' +
    '- descFa/descEn: ONE short sentence describing what this prompt does (fa/en).\n' +
    '- usageFa/usageEn: 2-3 sentences explaining HOW to use this prompt (which tool/model, where to paste, tips) (fa/en).\n' +
    '- categorySlug: choose ONE from: ' +
    opts.categories.map((c) => c.slug).join(', ') +
    '\n- tagsFa: choose MAX 4 ONLY from: ' +
    TAG_VOCAB.map((t) => t.fa).join('، ') +
    '\n- tagsEn: English equivalents of chosen tagsFa in same order.'

  const parts: any[] = [{ text: instruction + '\n\nTHE PROMPT TEXT:\n' + (opts.text || '(no text, look at image)') }]
  if (opts.imgBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: opts.imgBase64 } })

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + process.env.GEMINI_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
      signal: AbortSignal.timeout(25000),
    }
  )

  const body = await res.text()
  if (!res.ok) {
    throw new Error('Gemini HTTP ' + res.status + ' :: ' + body.slice(0, 300))
  }

  const json = JSON.parse(body)
  const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!raw) throw new Error('Gemini empty response :: ' + body.slice(0, 300))

  const m = raw.match(/\{[\s\S]*\}/)
  const parsed = m ? JSON.parse(m[0]) : {}

  const tagsFa: string[] = (parsed.tagsFa ?? []).slice(0, 4)
  const tagsEn: string[] = tagsFa.map((fa: string) => {
    const v = TAG_VOCAB.find((t) => t.fa === fa)
    return v ? v.en : fa
  })
  const catOk = opts.categories.some((c) => c.slug === parsed.categorySlug)

  return {
    titleFa: parsed.titleFa || 'پرامپت هوش مصنوعی',
    titleEn: parsed.titleEn || 'AI Prompt',
    descFa: parsed.descFa || '',
    descEn: parsed.descEn || '',
    usageFa: parsed.usageFa || '',
    usageEn: parsed.usageEn || '',
    categorySlug: catOk ? parsed.categorySlug : opts.categories[0]?.slug ?? 'image',
    tagsFa,
    tagsEn,
  }
}
EOF

cat > src/app/api/cron/telegram/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchPage, diagnoseChannel, tgSendText, tgSendFile } from '@/lib/telegram'
import { analyzeWithGemini } from '@/lib/gemini'

export const maxDuration = 60

async function getSetting(key: string, def: string) {
  const s = await prisma.setting.findUnique({ where: { key } })
  return s?.value ?? def
}

async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const channel = process.env.TELEGRAM_CHANNEL
  if (!channel) return NextResponse.json({ error: 'no channel env' }, { status: 500 })

  if (searchParams.get('debug') === '1') {
    const d = await diagnoseChannel(channel)
    return NextResponse.json({ debug: d })
  }

  const synced = await getSetting('tg_synced', '0')

  if (synced !== '1') {
    const start = Date.now()
    let before = parseInt(await getSetting('tg_before', '0'), 10)
    let total = 0

    for (let i = 0; i < 12; i++) {
      if (Date.now() - start > 40000) break
      const page = before === 0 ? await fetchPage(channel) : await fetchPage(channel, before)
      if (page.length === 0) {
        await setSetting('tg_synced', '1')
        break
      }
      const minId = Math.min(...page.map((m) => m.id))
      await prisma.telegramQueue.createMany({
        data: page.map((m) => ({ id: m.id, text: m.text, img: m.img, reply: m.reply })),
        skipDuplicates: true,
      })
      total += page.length
      before = minId
      await setSetting('tg_before', String(before))
    }

    return NextResponse.json({
      ok: true,
      phase: 'sync',
      added: total,
      synced: await getSetting('tg_synced', '0'),
      ms: Date.now() - start,
    })
  }

  const item = await prisma.telegramQueue.findFirst({
    where: { status: 'PENDING' },
    orderBy: { id: 'asc' },
  })
  if (!item) return NextResponse.json({ ok: true, phase: 'idle', msg: 'all processed' })

  try {
    let promptText = (item.text ?? '').trim()
    let img = item.img
    const skipIds: number[] = []

    if (img && promptText.length < 40) {
      const next = await prisma.telegramQueue.findFirst({
        where: { id: { gt: item.id }, status: 'PENDING' },
        orderBy: { id: 'asc' },
      })
      if (next && !next.img && (next.text ?? '').length > 40) {
        promptText = (next.text ?? '').trim()
        skipIds.push(next.id)
      }
    }

    if (!img && promptText && item.reply) {
      const prev = await prisma.telegramQueue.findFirst({
        where: { id: { lt: item.id }, img: { not: null } },
        orderBy: { id: 'desc' },
      })
      if (prev && prev.id >= item.id - 3) img = prev.img
    }

    if (!promptText && !img) {
      await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'SKIPPED' } })
      return NextResponse.json({ ok: true, phase: 'skip-empty' })
    }

    // تصویر دائمی: کش در wsrv.nl + دانلود برای جمینای
    let finalImg = img
    let imgBase64: string | null = null
    if (img) {
      const wsrv = 'https://wsrv.nl/?url=' + encodeURIComponent(img) + '&w=900&q=75&output=webp'
      try {
        await fetch(wsrv, { signal: AbortSignal.timeout(9000) })
        finalImg = wsrv
      } catch {}
      try {
        const ir = await fetch(img, { signal: AbortSignal.timeout(8000) })
        const buf = Buffer.from(await ir.arrayBuffer())
        if (buf.length < 4_000_000) imgBase64 = buf.toString('base64')
      } catch {}
    }

    const categories = await prisma.category.findMany()
    const ai = await analyzeWithGemini({
      text: promptText || '(no text — describe the image as a prompt idea)',
      imgBase64,
      categories,
    })
    const cat = await prisma.category.findUnique({ where: { slug: ai.categorySlug } })

    const prompt = await prisma.prompt.create({
      data: {
        titleFa: ai.titleFa,
        titleEn: ai.titleEn,
        descFa: ai.descFa,
        descEn: ai.descEn,
        usageFa: ai.usageFa,
        usageEn: ai.usageEn,
        slug: 'tg-' + item.id,
        img: finalImg ?? 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop',
        model: /--v\s?\d|--ar/.test(promptText) ? 'Midjourney' : 'AI',
        type: img ? 'IMAGE' : 'TEXT',
        status: 'PUBLISHED',
        categoryId: cat?.id ?? categories[0].id,
        tagsFa: ai.tagsFa,
        tagsEn: ai.tagsEn,
        prompt: promptText || ai.descEn || ai.titleEn,
      },
    })

    await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'PROCESSED', promptId: prompt.id } })
    for (const sid of skipIds) {
      await prisma.telegramQueue.update({ where: { id: sid }, data: { status: 'MERGED', promptId: prompt.id } })
    }

    const out = process.env.TELEGRAM_OUTPUT
    if (out && process.env.TELEGRAM_BOT_TOKEN) {
      await tgSendText(out, '✨ ' + ai.titleFa)
      await tgSendFile(out, 'prompt-' + item.id + '.txt', promptText || ai.titleEn)
      await tgSendText(
        out,
        '📘 راهنمای استفاده:\n' + (ai.usageFa || '—') + '\n\n📘 How to use:\n' + (ai.usageEn || '—') + '\n\n🆔 ' + out + ' ⭐'
      )
    }

    return NextResponse.json({ ok: true, phase: 'processed', id: item.id, slug: prompt.slug, title: ai.titleFa })
  } catch (e: any) {
    await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'FAILED' } }).catch(() => {})
    return NextResponse.json({ ok: false, phase: 'failed', id: item.id, error: String(e?.message ?? e) }, { status: 500 })
  }
}
EOF

cat > src/app/api/debug/reset/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const delPrompts = await prisma.prompt.deleteMany({ where: { slug: { startsWith: 'tg-' } } })
  const delQueue = await prisma.telegramQueue.deleteMany({})
  await prisma.setting.upsert({ where: { key: 'tg_synced' }, update: { value: '0' }, create: { key: 'tg_synced', value: '0' } })
  await prisma.setting.upsert({ where: { key: 'tg_before' }, update: { value: '0' }, create: { key: 'tg_before', value: '0' } })

  return NextResponse.json({
    ok: true,
    deletedPrompts: delPrompts.count,
    deletedQueue: delQueue.count,
    msg: 'Garbage prompts + queue cleared. Sync will restart.',
  })
}
EOF

cat > src/app/api/debug/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let geminiTest: string
  try {
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' +
        (process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite') +
        ':generateContent?key=' +
        process.env.GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with the single word: OK' }] }] }),
        signal: AbortSignal.timeout(15000),
      }
    )
    const b = await r.text()
    geminiTest = r.ok ? 'OK: ' + (b.match(/"text":\s*"([^"]+)"/)?.[1] ?? 'answered') : 'HTTP ' + r.status + ' :: ' + b.slice(0, 250)
  } catch (e: any) {
    geminiTest = 'ERROR: ' + String(e?.message ?? e)
  }

  return NextResponse.json({
    envs: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'set (' + process.env.GEMINI_API_KEY!.length + ' chars)' : 'MISSING',
      GEMINI_MODEL: process.env.GEMINI_MODEL || 'default(gemini-2.0-flash-lite)',
      TELEGRAM_CHANNEL: process.env.TELEGRAM_CHANNEL || 'MISSING',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'set' : 'MISSING',
      TELEGRAM_OUTPUT: process.env.TELEGRAM_OUTPUT || 'MISSING',
    },
    geminiTest,
    time: new Date().toISOString(),
  })
}
EOF

echo "✅ Visible Gemini errors + permanent images + cleanup!"