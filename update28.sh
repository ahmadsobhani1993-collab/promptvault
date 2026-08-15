#!/bin/bash
set -e

cat > src/components/zoom-section.tsx << 'EOF'
export default function ZoomSection({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
EOF

cat >> src/app/globals.css << 'EOF'

html {
  scroll-behavior: smooth;
}
EOF

cat > src/lib/data.ts << 'EOF'
import type { Locale } from '@/lib/i18n'
import { prisma } from '@/lib/db'

export const L = (locale: Locale, fa: string, en: string) =>
  locale === 'fa' ? fa : en

export interface PromptType {
  value: string
  fa: string
  en: string
}

export const promptTypes: PromptType[] = [
  { value: 'IMAGE', fa: 'تصویر', en: 'Image' },
  { value: 'VIDEO', fa: 'ویدیو', en: 'Video' },
  { value: 'TEXT', fa: 'متن', en: 'Text' },
  { value: 'CODE', fa: 'کد', en: 'Code' },
  { value: 'AUDIO', fa: 'موسیقی', en: 'Music' },
]

export const getPromptTypeLabel = (type: string, locale: Locale) => {
  const t = promptTypes.find((x) => x.value === type)
  return t ? L(locale, t.fa, t.en) : type
}

export async function getCategories() {
  return prisma.category.findMany({
    orderBy: { order: 'asc' },
    include: { subs: true },
  })
}

export async function getPrompts(opts?: {
  type?: string
  q?: string
  categorySlug?: string
  subSlug?: string
  take?: number
}) {
  const where: any = { status: 'PUBLISHED' }
  if (opts?.type) where.type = opts.type
  if (opts?.categorySlug) where.category = { slug: opts.categorySlug }
  if (opts?.subSlug) where.sub = { slug: opts.subSlug }
  if (opts?.q) {
    const q = opts.q
    where.OR = [
      { titleFa: { contains: q, mode: 'insensitive' } },
      { titleEn: { contains: q, mode: 'insensitive' } },
      { prompt: { contains: q, mode: 'insensitive' } },
      { tagsFa: { hasSome: [q] } },
      { tagsEn: { hasSome: [q] } },
    ]
  }

  return prisma.prompt.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: opts?.take,
    include: { category: true, sub: true },
  })
}

export async function getPromptBySlug(slug: string) {
  return prisma.prompt.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: { category: true, sub: true },
  })
}

export async function getRelatedPrompts(categoryId: string, excludeSlug: string) {
  return prisma.prompt.findMany({
    where: { categoryId, status: 'PUBLISHED', NOT: { slug: excludeSlug } },
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: { category: true, sub: true },
  })
}

export async function getArticles() {
  return prisma.article.findMany({ orderBy: { createdAt: 'desc' } })
}

export async function getArticleBySlug(slug: string) {
  return prisma.article.findUnique({ where: { slug } })
}
EOF

cat > src/components/prompt-card.tsx << 'EOF'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n'
import { L, getPromptTypeLabel } from '@/lib/data'

type PromptItem = {
  slug: string
  titleFa: string
  titleEn: string
  img: string
  model: string
  type: string
  tagsFa: string[]
  tagsEn: string[]
  likes: number
  saves: number
  views: number
}

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K'
  return String(n)
}

export default function PromptCard({ item, locale }: { item: PromptItem; locale: Locale }) {
  return (
    <Link href={'/prompts/' + item.slug} className="block">
      <article className="card-cream glow-gold p-3 transition-transform hover:-translate-y-1">
        <div className="relative">
          <img src={item.img} alt={L(locale, item.titleFa, item.titleEn)} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
          <span className="absolute right-2 top-2 rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold text-[#171512]">
            {getPromptTypeLabel(item.type, locale)}
          </span>
          <span className="glow-soft absolute -bottom-3 right-2 grid h-10 w-10 place-items-center rounded-full border border-gold bg-[#1b1408] text-[9px] font-bold text-gold-bright">
            {item.model}
          </span>
        </div>
        <h3 className="mt-4 line-clamp-1 text-sm font-bold text-[#171512]">
          {L(locale, item.titleFa, item.titleEn)}
        </h3>
        <div className="mt-2 flex flex-wrap gap-1">
          {item.tagsFa.map((tag, i) => L(locale, tag, item.tagsEn[i] ?? tag)).map((tag) => (
            <Link
              key={tag}
              href={'/explore?q=' + encodeURIComponent(tag)}
              className="rounded-full bg-[#e7dcc4] px-2 py-0.5 text-[10px] text-[#5c5443] transition-colors hover:bg-gold hover:text-[#171512]"
            >
              {tag}
            </Link>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[#e2d8c2] pt-2 text-[10px] text-[#6b6353]">
          <span>{fmt(item.likes)} {L(locale, 'پسند', 'likes')}</span>
          <span>{fmt(item.saves)} {L(locale, 'ذخیره', 'saves')}</span>
          <span>{fmt(item.views)} {L(locale, 'بازدید', 'views')}</span>
        </div>
      </article>
    </Link>
  )
}
EOF

cat > src/lib/telegram.ts << 'EOF'
export type TgMessage = {
  id: number
  text: string
  img: string | null
  reply: boolean
  isPromptPlaceholder: boolean
}

function decode(s: string) {
  return s
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim()
}

const PROMPT_HINT = /پرامپت در پیام بعد|prompt in next|see next|👇/i

function parseRaw(html: string): TgMessage[] {
  const parts = html.split('<div class="tgme_widget_message_wrap')
  const out: TgMessage[] = []
  for (const p of parts.slice(1)) {
    const idm = p.match(/data-post="[^"]*\/(\d+)"/)
    if (!idm) continue
    const textM = p.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)
    const imgM = p.match(/background-image:url\('([^']+)'\)/)
    let img: string | null = null
    if (imgM) img = imgM[1].startsWith('//') ? 'https:' + imgM[1] : imgM[1]
    const text = textM ? decode(textM[1]) : ''
    out.push({
      id: parseInt(idm[1], 10),
      text,
      img,
      reply: p.includes('tgme_widget_message_reply'),
      isPromptPlaceholder: PROMPT_HINT.test(text) && text.length < 200,
    })
  }
  return out
}

function mergePairs(raw: TgMessage[]): TgMessage[] {
  const sorted = [...raw].sort((a, b) => a.id - b.id)
  const out: TgMessage[] = []
  let i = 0
  while (i < sorted.length) {
    const cur = sorted[i]
    const next = sorted[i + 1]
    if (
      cur.isPromptPlaceholder &&
      cur.img &&
      next &&
      !next.img &&
      next.text.length > 200 &&
      next.id <= cur.id + 2
    ) {
      out.push({ ...cur, text: next.text, reply: false, isPromptPlaceholder: false })
      i += 2
      continue
    }
    out.push(cur)
    i += 1
  }
  return out
}

async function fetchText(url: string, ms: number): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    signal: AbortSignal.timeout(ms),
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return await res.text()
}

export async function fetchPage(username: string, before?: number): Promise<TgMessage[]> {
  const url = 'https://t.me/s/' + username + (before ? '?before=' + before : '')
  let html: string
  try {
    html = await fetchText(url, 7000)
  } catch {
    html = await fetchText('https://api.allorigins.win/raw?url=' + encodeURIComponent(url), 9000)
  }
  return mergePairs(parseRaw(html))
}

export async function diagnoseChannel(username: string) {
  try {
    const direct = await fetchText('https://t.me/s/' + username, 7000)
    return { via: 'direct', messages: mergePairs(parseRaw(direct)).length }
  } catch (e: any) {
    try {
      const proxied = await fetchText(
        'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://t.me/s/' + username),
        9000
      )
      return { via: 'allorigins', messages: mergePairs(parseRaw(proxied)).length, directError: String(e?.message ?? e) }
    } catch (e2: any) {
      return { via: 'none', directError: String(e?.message ?? e), proxyError: String(e2?.message ?? e2) }
    }
  }
}

const TG = () => 'https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN

export async function tgSendText(chat: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(TG() + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function tgSendFile(chat: string, filename: string, content: string): Promise<boolean> {
  try {
    const form = new FormData()
    form.append('chat_id', chat)
    form.append('document', new Blob([content], { type: 'text/plain' }), filename)
    const res = await fetch(TG() + '/sendDocument', { method: 'POST', body: form, signal: AbortSignal.timeout(8000) })
    return res.ok
  } catch {
    return false
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

    let tg: any = null
    const out = process.env.TELEGRAM_OUTPUT
    if (out && process.env.TELEGRAM_BOT_TOKEN) {
      tg = {
        title: await tgSendText(out, '✨ ' + ai.titleFa),
        file: await tgSendFile(out, 'prompt-' + item.id + '.txt', promptText || ai.titleEn),
        usage: await tgSendText(
          out,
          '📘 راهنمای استفاده:\n' + (ai.usageFa || '—') + '\n\n📘 How to use:\n' + (ai.usageEn || '—')
        ),
      }
    }

    return NextResponse.json({ ok: true, phase: 'processed', id: item.id, slug: prompt.slug, title: ai.titleFa, tg })
  } catch (e: any) {
    await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'FAILED' } }).catch(() => {})
    return NextResponse.json({ ok: false, phase: 'failed', id: item.id, error: String(e?.message ?? e) }, { status: 500 })
  }
}
EOF

echo "✅ Newest-first + smooth scroll + clickable tags + telegram fixes!"