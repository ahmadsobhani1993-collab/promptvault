#!/bin/bash
set -e

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

export async function tgSendPhoto(chat: string, photo: string, caption: string): Promise<boolean> {
  try {
    const res = await fetch(TG() + '/sendPhoto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, photo, caption }),
      signal: AbortSignal.timeout(10000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function tgSendCode(chat: string, code: string, footer?: string): Promise<boolean> {
  try {
    const body = code.length > 4000 ? code.slice(0, 4000) + '\n…' : code
    const text = body + (footer ?? '')
    const res = await fetch(TG() + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text,
        entities: [{ type: 'pre', offset: 0, length: body.length, language: '' }],
      }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}
EOF

cat > src/app/api/cron/telegram/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchPage, diagnoseChannel, tgSendText, tgSendPhoto, tgSendCode } from '@/lib/telegram'
import { analyzeWithGemini } from '@/lib/gemini'

export const maxDuration = 60

const TG_FOOTER = '\n\n🔗 @Prompts_fa'

async function getSetting(key: string, def: string) {
  const s = await prisma.setting.findUnique({ where: { key } })
  return s?.value ?? def
}

async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
}

function tehranNow() {
  const now = new Date()
  const hour = parseInt(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: 'numeric', hour12: false }).format(now),
    10
  )
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now)
  return { hour, date }
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

    const finalPrompt = (ai.promptEn || promptText).trim()

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
        model: /--v\s?\d|--ar/.test(finalPrompt) ? 'Midjourney' : 'AI',
        type: img ? 'IMAGE' : 'TEXT',
        status: 'PUBLISHED',
        categoryId: cat?.id ?? categories[0].id,
        tagsFa: ai.tagsFa,
        tagsEn: ai.tagsEn,
        prompt: finalPrompt,
      },
    })

    await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'PROCESSED', promptId: prompt.id } })
    for (const sid of skipIds) {
      await prisma.telegramQueue.update({ where: { id: sid }, data: { status: 'MERGED', promptId: prompt.id } })
    }

    // ---------- Telegram output (limited: 24/day, 12-23 Tehran) ----------
    let tg: any = null
    const out = process.env.TELEGRAM_OUTPUT
    if (out && process.env.TELEGRAM_BOT_TOKEN) {
      const { hour, date } = tehranNow()
      const sentDate = await getSetting('tg_sent_date', '')
      let sentCount = sentDate === date ? parseInt(await getSetting('tg_sent_count', '0'), 10) : 0
      const inWindow = hour >= 12 && hour <= 23

      if (!inWindow) {
        tg = { skipped: true, reason: 'outside Tehran window (12:00-23:59). current hour: ' + hour }
      } else if (sentCount >= 24) {
        tg = { skipped: true, reason: 'daily limit 24 reached' }
      } else {
        const tagLine = ai.tagsFa.map((t) => '#' + t.replace(/\s+/g, '_')).join(' ')
        const usageFa = (ai.usageFa || '').trim()

        const fullCaption =
          '✨ ' + ai.titleFa + '\n\n' + finalPrompt + '\n\n📘 ' + usageFa + '\n\n' + tagLine + TG_FOOTER

        const shortCaption = '✨ ' + ai.titleFa + '\n\n📘 ' + usageFa + '\n\n' + tagLine + TG_FOOTER

        if (fullCaption.length <= 1024) {
          tg = {
            single: img
              ? await tgSendPhoto(out, finalImg ?? img, fullCaption)
              : await tgSendText(out, fullCaption),
          }
        } else {
          tg = {
            photo: img
              ? await tgSendPhoto(out, finalImg ?? img, shortCaption)
              : await tgSendText(out, shortCaption),
            code: await tgSendCode(out, finalPrompt, TG_FOOTER),
          }
        }

        await setSetting('tg_sent_date', date)
        await setSetting('tg_sent_count', String(sentCount + 1))
      }
    }

    return NextResponse.json({ ok: true, phase: 'processed', id: item.id, slug: prompt.slug, title: ai.titleFa, tg })
  } catch (e: any) {
    await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'FAILED' } }).catch(() => {})
    return NextResponse.json({ ok: false, phase: 'failed', id: item.id, error: String(e?.message ?? e) }, { status: 500 })
  }
}
EOF

echo "✅ TG footer + 24/day limit + Tehran window!"