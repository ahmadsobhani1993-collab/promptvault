import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export const maxDuration = 30

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'login required' }, { status: 401 })

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const storage = (await prisma.setting.findUnique({ where: { key: 'tg_storage_chat' } }))?.value ?? (await prisma.setting.findUnique({ where: { key: 'tg_private_chat' } }))?.value
  if (!token || !storage) return NextResponse.json({ error: 'storage not configured' }, { status: 500 })

  const { dataUrl } = await req.json()
  const m = String(dataUrl ?? '').match(/^data:(image\/[a-z+]+);base64,(.+)$/)
  if (!m) return NextResponse.json({ error: 'bad image' }, { status: 400 })

  const buf = Buffer.from(m[2], 'base64')
  if (buf.length > 1_000_000) return NextResponse.json({ error: 'حجم تصویر باید کمتر از ۱ مگابایت باشد', tooBig: true }, { status: 400 })

  const form = new FormData()
  form.append('chat_id', storage)
  form.append('photo', new Blob([new Uint8Array(buf)], { type: m[1] }), 'upload.jpg')
  const r = await fetch('https://api.telegram.org/bot' + token + '/sendPhoto', { method: 'POST', body: form, signal: AbortSignal.timeout(20000) })
  const j = await r.json()
  const photos = j?.result?.photo
  if (!j.ok || !photos?.length) return NextResponse.json({ error: 'telegram upload failed: ' + (j.description ?? '') }, { status: 500 })

  const fileId = photos[photos.length - 1].file_id
  const up = await prisma.uploadImage.create({ data: { fileId } })

  return NextResponse.json({ ok: true, id: up.id, url: (process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir') + '/api/img/' + up.id })
}
