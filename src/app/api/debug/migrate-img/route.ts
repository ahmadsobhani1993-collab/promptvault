import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const storage = (await prisma.setting.findUnique({ where: { key: 'tg_storage_chat' } }))?.value ?? (await prisma.setting.findUnique({ where: { key: 'tg_private_chat' } }))?.value
  if (!token || !storage) return NextResponse.json({ error: 'storage not set — run /api/debug/set-storage first' }, { status: 500 })

  const rows = await prisma.promptImage.findMany({ where: { OR: [{ type: null }, { type: 'image/jpeg' }, { type: 'image/png' }, { type: 'image/webp' }] }, take: 10 })

  let moved = 0
  const errors: string[] = []
  for (const r of rows) {
    if (r.data.length < 500) continue
    try {
      const buf = Buffer.from(r.data, 'base64')
      const form = new FormData()
      form.append('chat_id', storage)
      form.append('photo', new Blob([new Uint8Array(buf)], { type: r.type ?? 'image/jpeg' }), 'img.jpg')
      const res = await fetch('https://api.telegram.org/bot' + token + '/sendPhoto', { method: 'POST', body: form, signal: AbortSignal.timeout(25000) })
      const j = await res.json()
      const fileId = j?.result?.photo?.[j.result.photo.length - 1]?.file_id
      if (!fileId) { errors.push(r.promptId + ': ' + (j.description ?? 'no file')); continue }
      await prisma.promptImage.update({ where: { promptId: r.promptId }, data: { data: fileId, type: 'tg' } })
      moved++
    } catch (e: any) {
      errors.push(r.promptId + ': ' + String(e?.message ?? e))
    }
  }

  const left = await prisma.promptImage.count({ where: { OR: [{ type: null }, { type: 'image/jpeg' }, { type: 'image/png' }, { type: 'image/webp' }] } })
  return NextResponse.json({ ok: true, moved, left, errors })
}
