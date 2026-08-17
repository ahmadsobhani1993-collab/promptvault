#!/bin/bash
set -e

# ---------- 1) import: stop base64, use telegram storage ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/debug/import/route.ts'
let s = fs.readFileSync(p, 'utf8')

s = s.replace(/imgData: imgBase64, imgType,\n/g, '')
s = s.replace(
  "await prisma.promptImage.create({ data: { promptId: prompt.id, data: imgBase64, type: imgType } }).catch(() => {})",
  "await prisma.promptImage.create({ data: { promptId: prompt.id, data: fileId, type: 'tg' } }).catch(() => {})"
)

fs.writeFileSync(p, s)
console.log('✅ import: telegram storage now')
NODEEOF

# ---------- 2) fix-imgs: comprehensive repair ----------
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
  if (!token || !storage) return NextResponse.json({ error: 'storage missing' }, { status: 500 })

  const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'
  const api = (m: string, q: Record<string, string>) =>
    'https://api.telegram.org/bot' + token + '/' + m + '?' + new URLSearchParams(q).toString()

  async function uploadToStorage(buf: Buffer, type: string): Promise<string | null> {
    const form = new FormData()
    form.append('chat_id', storage!)
    form.append('photo', new Blob([new Uint8Array(buf)], { type }), 'img.jpg')
    const r = await fetch('https://api.telegram.org/bot' + token + '/sendPhoto', { method: 'POST', body: form, signal: AbortSignal.timeout(25000) })
    const j = await r.json()
    const photos = j?.result?.photo
    return photos?.length ? photos[photos.length - 1].file_id : null
  }

  let movedRows = 0
  let movedPrompt = 0
  let repaired = 0
  const errors: string[] = []

  // case 1: PromptImage rows still holding base64 -> move to telegram
  const rows = await prisma.promptImage.findMany({ where: { NOT: { type: 'tg' } }, take: 10 })
  for (const r of rows) {
    try {
      const fid = await uploadToStorage(Buffer.from(r.data, 'base64'), r.type ?? 'image/jpeg')
      if (!fid) { errors.push(r.promptId + ': upload fail'); continue }
      await prisma.promptImage.update({ where: { promptId: r.promptId }, data: { data: fid, type: 'tg' } })
      movedRows++
    } catch (e: any) { errors.push(r.promptId + ': ' + String(e?.message ?? e)) }
  }

  // case 2: prompts still holding imgData base64 -> move to telegram
  const withData = await prisma.prompt.findMany({ where: { NOT: { imgData: null } }, take: 10 })
  for (const p of withData) {
    try {
      const fid = await uploadToStorage(Buffer.from(p.imgData!, 'base64'), p.imgType ?? 'image/jpeg')
      if (!fid) { errors.push(p.id + ': upload fail'); continue }
      await prisma.promptImage.upsert({ where: { promptId: p.id }, update: { data: fid, type: 'tg' }, create: { promptId: p.id, data: fid, type: 'tg' } })
      await prisma.prompt.update({ where: { id: p.id }, data: { imgData: null, imgType: null, img: APP + '/api/img/' + p.id } })
      movedPrompt++
    } catch (e: any) { errors.push(p.id + ': ' + String(e?.message ?? e)) }
  }

  // case 3: prompts with no image row at all -> forward from channel
  if (source) {
    const missing = await prisma.prompt.findMany({ where: { imgData: null }, take: 30 })
    for (const p of missing) {
      const hasRow = await prisma.promptImage.findUnique({ where: { promptId: p.id } })
      if (hasRow) continue
      const m = p.slug.match(/tg-(\d+)/) || p.img.match(/tmp-(\d+)/) || p.img.match(/new-(\d+)/)
      if (!m) continue
      const f = await (await fetch(api('forwardMessage', { chat_id: storage, from_chat_id: source, message_id: m[1] }), { signal: AbortSignal.timeout(10000) })).json()
      const fid = f?.result?.photo?.length ? f.result.photo[f.result.photo.length - 1].file_id : null
      if (!fid) { errors.push(p.id + ': fwd fail'); continue }
      await prisma.promptImage.create({ data: { promptId: p.id, data: fid, type: 'tg' } }).catch(() => {})
      await prisma.prompt.update({ where: { id: p.id }, data: { img: APP + '/api/img/' + p.id } })
      repaired++
    }
  }

  const leftRows = await prisma.promptImage.count({ where: { NOT: { type: 'tg' } } })
  const leftPrompt = await prisma.prompt.count({ where: { NOT: { imgData: null } } })

  return NextResponse.json({ ok: true, movedRows, movedPrompt, repaired, leftRows, leftPrompt, errors: errors.slice(0, 5) })
}
EOF

echo "✅ update82 done!"