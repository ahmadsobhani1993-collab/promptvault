#!/bin/bash
set -e

mkdir -p src/app/api/debug/reset

cat > src/app/api/debug/reset/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const deleted = await prisma.telegramQueue.deleteMany({})
  await prisma.setting.upsert({
    where: { key: 'tg_synced' },
    update: { value: '0' },
    create: { key: 'tg_synced', value: '0' },
  })
  await prisma.setting.upsert({
    where: { key: 'tg_before' },
    update: { value: '0' },
    create: { key: 'tg_before', value: '0' },
  })

  return NextResponse.json({ ok: true, deleted: deleted.count, msg: 'Queue reset — sync will restart from scratch' })
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
    .replace(/\u200c/g, '')
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

// ادغام پست‌های جفت: placeholder + عکس → با متن پیام بعدی
function mergePairs(raw: TgMessage[]): TgMessage[] {
  // مرتب‌سازی صعودی بر اساس id
  const sorted = [...raw].sort((a, b) => a.id - b.id)
  const out: TgMessage[] = []
  let i = 0
  while (i < sorted.length) {
    const cur = sorted[i]
    const next = sorted[i + 1]
    // اگر این یک placeholder با عکس است و بعدی متن طولانی دارد، ترکیب کن
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

export async function tgSendText(chat: string, text: string) {
  await fetch(TG() + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => {})
}

export async function tgSendFile(chat: string, filename: string, content: string) {
  const form = new FormData()
  form.append('chat_id', chat)
  form.append('document', new Blob([content], { type: 'text/plain' }), filename)
  await fetch(TG() + '/sendDocument', { method: 'POST', body: form, signal: AbortSignal.timeout(8000) }).catch(() => {})
}
EOF

echo "✅ Smart parser (merges paired posts) + reset endpoint ready!"