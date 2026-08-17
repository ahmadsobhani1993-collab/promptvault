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
