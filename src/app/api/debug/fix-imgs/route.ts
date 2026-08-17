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
  let relinked = 0
  const errors: string[] = []

  // case 1: PromptImage rows still holding base64
  const rows = await prisma.promptImage.findMany({ where: { NOT: { type: 'tg' } }, take: 10 })
  for (const r of rows) {
    try {
      const fid = await uploadToStorage(Buffer.from(r.data, 'base64'), r.type ?? 'image/jpeg')
      if (!fid) { errors.push(r.promptId + ': upload fail'); continue }
      await prisma.promptImage.update({ where: { promptId: r.promptId }, data: { data: fid, type: 'tg' } })
      movedRows++
    } catch (e: any) { errors.push(r.promptId + ': ' + String(e?.message ?? e)) }
  }

  // case 2: prompts still holding imgData base64
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

  // case 3: prompts whose img is NOT our /api/img (fallback urls) -> forward repair
  if (source) {
    const bad = await prisma.prompt.findMany({ where: { NOT: { img: { contains: '/api/img/' } } }, take: 50 })
    for (const p of bad) {
      const m = p.slug.match(/tg-(\d+)/)
      if (!m) continue
      const f = await (await fetch(api('forwardMessage', { chat_id: storage, from_chat_id: source, message_id: m[1] }), { signal: AbortSignal.timeout(10000) })).json()
      const fid = f?.result?.photo?.length ? f.result.photo[f.result.photo.length - 1].file_id : null
      if (!fid) { errors.push(p.slug + ': fwd fail'); continue }
      await prisma.promptImage.upsert({ where: { promptId: p.id }, update: { data: fid, type: 'tg' }, create: { promptId: p.id, data: fid, type: 'tg' } })
      await prisma.prompt.update({ where: { id: p.id }, data: { img: APP + '/api/img/' + p.id } })
      repaired++
    }
  }

  // case 4: prompts that have a tg row but img not linked yet
  const unlinked = await prisma.prompt.findMany({ where: { imgData: null, NOT: { img: { contains: '/api/img/' } } }, take: 0 })
  relinked = unlinked.length

  // diagnostic sample: check getFile for a few tg rows
  const sampleRows = await prisma.promptImage.findMany({ where: { type: 'tg' }, take: 5 })
  const sample: any[] = []
  for (const r of sampleRows) {
    let ok = false
    let desc: string | null = null
    let path: string | null = null
    try {
      const g = await (await fetch('https://api.telegram.org/bot' + token + '/getFile?file_id=' + encodeURIComponent(r.data), { signal: AbortSignal.timeout(8000) })).json()
      ok = !!g?.result?.file_path
      path = g?.result?.file_path ?? null
      desc = g?.description ?? null
    } catch (e: any) { desc = String(e?.message ?? e) }
    sample.push({ promptId: r.promptId, dataLen: r.data.length, dataHead: r.data.slice(0, 40), getFileOk: ok, path, desc })
  }

  const leftBad = await prisma.prompt.count({ where: { NOT: { img: { contains: '/api/img/' } } } })
  const leftRows = await prisma.promptImage.count({ where: { NOT: { type: 'tg' } } })
  const leftPrompt = await prisma.prompt.count({ where: { NOT: { imgData: null } } })

  return NextResponse.json({ ok: true, movedRows, movedPrompt, repaired, leftBad, leftRows, leftPrompt, sample, errors: errors.slice(0, 8) })
}
