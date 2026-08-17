#!/bin/bash
set -e

mkdir -p src/app/api/debug/fix-imgs

# ---------- 1) img route: proxy bytes (no redirect, no token leak) ----------
cat > 'src/app/api/img/[id]/route.ts' << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function tgFileUrl(fileId: string): Promise<string | null> {
  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  try {
    const r = await fetch('https://api.telegram.org/bot' + token + '/getFile?file_id=' + encodeURIComponent(fileId), { signal: AbortSignal.timeout(8000) })
    const j = await r.json()
    const path = j?.result?.file_path
    return path ? 'https://api.telegram.org/file/bot' + token + '/' + path : null
  } catch {
    return null
  }
}

function typeFromUrl(url: string) {
  if (url.endsWith('.png')) return 'image/png'
  if (url.endsWith('.webp')) return 'image/webp'
  if (url.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

async function proxyFromTg(fileId: string) {
  const url = await tgFileUrl(fileId)
  if (!url) return null
  try {
    const up = await fetch(url, { signal: AbortSignal.timeout(20000) })
    if (!up.ok) return null
    const buf = Buffer.from(await up.arrayBuffer())
    if (buf.length < 1000) return null
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': typeFromUrl(url),
        'Cache-Control': 'public, max-age=31536000, immutable, s-maxage=31536000',
      },
    })
  } catch {
    return null
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const row = await prisma.promptImage.findUnique({ where: { promptId: id } })
  if (row?.type === 'tg') {
    const r = await proxyFromTg(row.data)
    if (r) return r
  } else if (row?.data) {
    return new Response(Buffer.from(row.data, 'base64'), {
      headers: { 'Content-Type': row.type ?? 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
    })
  }

  const up = await prisma.uploadImage.findUnique({ where: { id } })
  if (up) {
    const r = await proxyFromTg(up.fileId)
    if (r) return r
  }

  const p = await prisma.prompt.findUnique({ where: { id }, select: { imgData: true, imgType: true } })
  if (p?.imgData) {
    return new Response(Buffer.from(p.imgData, 'base64'), {
      headers: { 'Content-Type': p.imgType ?? 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
    })
  }

  return NextResponse.json({ error: 'not found' }, { status: 404 })
}
EOF

# ---------- 2) repair missing images via channel forward ----------
cat > src/app/api/debug/fix-imgs/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const storage = (await prisma.setting.findUnique({ where: { key: 'tg_storage_chat' } }))?.value
  const source = (await prisma.setting.findUnique({ where: { key: 'tg_chat_id' } }))?.value
  if (!token || !storage || !source) return NextResponse.json({ error: 'config missing' }, { status: 500 })

  const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'
  const prompts = await prisma.prompt.findMany({ where: { imgData: null }, take: 50 })

  let fixed = 0
  let skipped = 0
  const errors: string[] = []

  for (const p of prompts) {
    const hasRow = await prisma.promptImage.findUnique({ where: { promptId: p.id } })
    if (hasRow) { skipped++; continue }

    const m = p.slug.match(/tg-(\d+)/) || p.img.match(/tmp-(\d+)/) || p.img.match(/new-(\d+)/)
    if (!m) continue
    const msgId = m[1]

    const f = await (await fetch(
      'https://api.telegram.org/bot' + token + '/forwardMessage?chat_id=' + encodeURIComponent(storage) + '&from_chat_id=' + encodeURIComponent(source) + '&message_id=' + msgId,
      { signal: AbortSignal.timeout(10000) }
    )).json()
    if (!f.ok) { errors.push(p.id + ': ' + (f.description ?? 'fwd fail')); continue }

    const photos = f.result?.photo
    const fileId = photos?.length ? photos[photos.length - 1].file_id : null
    if (!fileId) { errors.push(p.id + ': no photo'); continue }

    await prisma.promptImage.create({ data: { promptId: p.id, data: fileId, type: 'tg' } }).catch(() => {})
    await prisma.prompt.update({ where: { id: p.id }, data: { img: APP + '/api/img/' + p.id } })
    fixed++
  }

  return NextResponse.json({ ok: true, fixed, skipped, errors: errors.slice(0, 5) })
}
EOF

echo "✅ update81 done!"