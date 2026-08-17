#!/bin/bash
set -e

mkdir -p src/app/api/cron/broadcast

# ---------- 1) loader: thin top bar, never blocks ----------
cat > src/components/route-loader.tsx << 'EOF'
'use client'

import { useEffect } from 'react'

export default function RouteLoader() {
  useEffect(() => {
    const start = () => document.body.classList.add('route-loading')
    const stop = () => document.body.classList.remove('route-loading')
    const handler = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a')
      if (!a) return
      const href = a.getAttribute('href') || ''
      if (!href.startsWith('/') || a.target === '_blank' || e.metaKey || e.ctrlKey) return
      start()
      setTimeout(stop, 4000)
    }
    document.addEventListener('click', handler)
    window.addEventListener('load', stop)
    window.addEventListener('pageshow', stop)
    return () => document.removeEventListener('click', handler)
  }, [])

  return <div className="route-bar" aria-hidden="true" />
}
EOF

cat >> src/app/globals.css << 'EOF'

.route-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 100;
  pointer-events: none;
  background: transparent;
}
body.route-loading .route-bar {
  background: linear-gradient(90deg, transparent, #d4a94e 40%, #f0d491 50%, #d4a94e 60%, transparent);
  background-size: 200% 100%;
  animation: routebar 1.1s linear infinite;
  box-shadow: 0 0 12px rgba(212, 169, 78, 0.6);
}
@keyframes routebar {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
body.route-loading { overflow: hidden; }
EOF

# ---------- 2) cron: lenient pair merge (look ahead 3) ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/telegram/route.ts'
let s = fs.readFileSync(p, 'utf8')

const old = `  // merge photo + following long text
  const merged: { id: number; text: string; fileId: string | null }[] = []
  for (let i = 0; i < posts.length; i++) {
    const cur = posts[i]
    const next = posts[i + 1]
    const curText = (cur.caption || cur.text || '').trim()
    const fileId = cur.photo?.length ? cur.photo[cur.photo.length - 1].file_id : null
    if (fileId && curText.length < 60 && next && !next.photo && ((next.text || next.caption || '').trim().length > 60)) {
      merged.push({ id: cur.message_id, text: (next.text || next.caption).trim(), fileId })
      i++
    } else {
      merged.push({ id: cur.message_id, text: curText, fileId })
    }
  }`

const nw = `  // merge photo + following long text (look ahead up to 3)
  const merged: { id: number; text: string; fileId: string | null }[] = []
  for (let i = 0; i < posts.length; i++) {
    const cur = posts[i]
    const curText = (cur.caption || cur.text || '').trim()
    const fileId = cur.photo?.length ? cur.photo[cur.photo.length - 1].file_id : null
    if (fileId && curText.length < 60) {
      let j = i + 1
      let longText = ''
      while (j < posts.length && j <= i + 3) {
        const cand = posts[j]
        if (!cand.photo && ((cand.text || cand.caption || '').trim().length > 60)) { longText = (cand.text || cand.caption).trim(); break }
        j++
      }
      if (longText) { merged.push({ id: cur.message_id, text: longText, fileId }); i = j }
      else merged.push({ id: cur.message_id, text: curText, fileId })
    } else {
      merged.push({ id: cur.message_id, text: curText, fileId })
    }
  }`

if (s.includes(old)) { s = s.replace(old, nw); fs.writeFileSync(p, s); console.log('✅ cron: lenient merge') }
else console.log('❌ cron merge pattern not found')
NODEEOF

# ---------- 3) import: lenient pair merge ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/debug/import/route.ts'
let s = fs.readFileSync(p, 'utf8')

const old = `    if (fileId && text.length < 60) {
      const f2 = await (await fetch(api('forwardMessage', { chat_id: priv, from_chat_id: chatId, message_id: String(cursor + 1) }), { signal: AbortSignal.timeout(10000) })).json()
      if (f2.ok && !f2.result.photo && (f2.result.text || '').trim().length > 60) {
        text = f2.result.text.trim()
        fwdIds.push(f2.result.message_id)
        advanced = 2
      }
    }`

const nw = `    if (fileId && text.length < 60) {
      for (let off = 1; off <= 3; off++) {
        const f2 = await (await fetch(api('forwardMessage', { chat_id: priv, from_chat_id: chatId, message_id: String(cursor + off) }), { signal: AbortSignal.timeout(10000) })).json()
        if (f2.ok && !f2.result.photo && (f2.result.text || '').trim().length > 60) {
          text = f2.result.text.trim()
          fwdIds.push(f2.result.message_id)
          advanced = off + 1
          break
        }
        if (f2.ok) { await fetch(api('deleteMessage', { chat_id: priv, message_id: String(f2.result.message_id) })).catch(() => {}) }
        if (!f2.ok) break
      }
    }`

if (s.includes(old)) { s = s.replace(old, nw); fs.writeFileSync(p, s); console.log('✅ import: lenient merge') }
else console.log('❌ import merge pattern not found')
NODEEOF

# ---------- 4) broadcast: 20 random prompts/day via finsophbot ----------
cat > src/app/api/cron/broadcast/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { tgSendPhoto } from '@/lib/telegram'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 30

const TG_FOOTER = '\n\n🔗 @Prompts_fa'
const APP = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'

async function getSetting(key: string, def: string) {
  return (await prisma.setting.findUnique({ where: { key } }))?.value ?? def
}
async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const out = process.env.TELEGRAM_OUTPUT
  if (!out) return NextResponse.json({ error: 'no output channel' }, { status: 500 })

  const hour = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: 'numeric', hour12: false }).format(new Date()), 10)
  if (hour < 12 || hour > 23) return NextResponse.json({ ok: true, skipped: 'outside window', hour })

  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date())
  const sentDate = await getSetting('bc_sent_date', '')
  const sent = sentDate === date ? parseInt(await getSetting('bc_sent_count', '0'), 10) : 0
  if (sent >= 20) return NextResponse.json({ ok: true, skipped: 'daily cap 20 reached', sent })

  const recent = (await getSetting('bc_recent', '')).split(',').filter(Boolean)
  const pool = await prisma.prompt.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    take: 150,
    select: { id: true, slug: true, titleFa: true, usageFa: true, tagsFa: true, img: true },
  })
  const candidates = pool.filter((p) => !recent.includes(p.id))
  const list = candidates.length ? candidates : pool
  const pick = list[Math.floor(Math.random() * list.length)]
  if (!pick) return NextResponse.json({ ok: true, skipped: 'no prompts' })

  const tagLine = (pick.tagsFa ?? []).map((t) => '#' + t.replace(/\s+/g, '_')).join(' ')
  const url = APP() + '/prompts/' + pick.slug
  const caption = '✨ ' + pick.titleFa + '\n\n📘 ' + (pick.usageFa ?? '') + '\n\n' + tagLine + '\n\n🌐 ' + url + TG_FOOTER

  const r = await tgSendPhoto(out, pick.img, caption)

  await setSetting('bc_sent_date', date)
  await setSetting('bc_sent_count', String(sent + 1))
  await setSetting('bc_recent', [pick.id, ...recent].slice(0, 60).join(','))

  return NextResponse.json({ ok: true, sent: sent + 1, slug: pick.slug, tg: r })
}
EOF

echo "✅ update65 done!"