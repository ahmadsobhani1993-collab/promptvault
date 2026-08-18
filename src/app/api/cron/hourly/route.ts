import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'
import { tgSendPhoto, tgSendCode, tgSendText } from '@/lib/telegram'
import { sendToInstagramCustom } from '@/lib/instagram'

export const maxDuration = 60
const faDigits = (n: number) => String(n).replace(/\d/g, (d) => '۰۱۳۴۵۶۷۸۹'[+d])

async function getSet(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}
async function setSet(k: string, v: string) {
  await prisma.setting.upsert({ where: { key: k }, update: { value: v }, create: { key: k, value: v } })
}

async function photoBuffer(promptId: string, fallback: string): Promise<Buffer | null> {
  try {
    const row = await prisma.promptImage.findUnique({ where: { promptId } })
    if (row?.type === 'tg') {
      const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
      const g = await (await fetch('https://api.telegram.org/bot' + token + '/getFile?file_id=' + encodeURIComponent(row.data), { signal: AbortSignal.timeout(8000) })).json()
      if (g?.result?.file_path) {
        const r = await fetch('https://api.telegram.org/file/bot' + token + '/' + g.result.file_path, { signal: AbortSignal.timeout(20000) })
        if (r.ok) {
          const b = Buffer.from(await r.arrayBuffer())
          if (b.length > 1000) return b
        }
      }
    }
  } catch {}
  try {
    const r = await fetch(fallback, { signal: AbortSignal.timeout(20000) })
    if (r.ok) return Buffer.from(await r.arrayBuffer())
  } catch {}
  return null
}

async function tgPhotoBytes(chat: string, buf: Buffer, caption: string) {
  const token = process.env.TELEGRAM_OUTPUT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const form = new FormData()
  form.append('chat_id', chat)
  form.append('photo', new Blob([new Uint8Array(buf)], { type: 'image/jpeg' }), 'photo.jpg')
  form.append('caption', caption)
  const r = await fetch('https://api.telegram.org/bot' + token + '/sendPhoto', { method: 'POST', body: form, signal: AbortSignal.timeout(30000) })
  return await r.json()
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // get already-sent IDs
  let sentIds: string[] = []
  try { sentIds = JSON.parse(await getSet('hourly_sent_ids', '[]')) } catch {}

  // get pool
  let pool = await prisma.prompt.findMany({
    where: { status: 'PUBLISHED', NOT: { id: { in: sentIds } } },
    select: { id: true },
    take: 500,
  })

  // if exhausted, reset
  if (pool.length === 0) {
    sentIds = []
    await setSet('hourly_sent_ids', '[]')
    pool = await prisma.prompt.findMany({ where: { status: 'PUBLISHED' }, select: { id: true }, take: 500 })
  }

  if (pool.length === 0) return NextResponse.json({ ok: true, skipped: 'no prompts' })

  // pick 1 random
  const pick = pool[Math.floor(Math.random() * pool.length)]
  const p = await prisma.prompt.findUnique({ where: { id: pick.id }, include: { category: true } })
  if (!p) return NextResponse.json({ ok: true, skipped: 'not found' })

  const tagLine = (p.tagsFa ?? []).map((t: string) => '#' + t.replace(/\s+/g, '_')).join(' ')
  const app = process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'
  const slugLink = app + '/prompts/' + p.slug

  // Telegram: photo(caption=title) + code(prompt+tags+site+channel)
  const tgOut = process.env.TELEGRAM_OUTPUT
  if (tgOut) {
    const buf = await photoBuffer(p.id, p.img)
    if (buf) await tgPhotoBytes(tgOut, buf, '✨ ' + p.titleFa + ' \n\n🔗 ' + slugLink).catch(() => {})
    await tgSendCode(tgOut, p.prompt, '\n\n' + tagLine + '\n\nPROMPTSFA.IR\n@Prompts_fa').catch(() => {})
  }

  // Instagram: photo + tags + follow message + counter
  const n = parseInt(await getSet('ig_counter', '20'), 10)
  const igCaption =
    tagLine +
    '\n\nبرای دریافت پرامپت‌های بیشتر به سایت ما مراجعه کنید\n' +
    'برای دریافت این پرامپت ابتدا ما را فالو کرده و سپس عدد ' + faDigits(n) + ' را ارسال کنید.'
  await sendToInstagramCustom(p, igCaption).catch(() => {})
  await setSet('ig_counter', String(n + 1))

  // mark as sent
  await setSet('hourly_sent_ids', JSON.stringify([...sentIds, p.id]))

  return NextResponse.json({ ok: true, slug: p.slug, sentTo: ['telegram', 'instagram'], igNumber: n })
}
