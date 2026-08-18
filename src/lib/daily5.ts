import { prisma } from '@/lib/db'
import { tgSendPhoto, tgSendCode, tgSendText } from '@/lib/telegram'
import { sendToInstagramCustom } from '@/lib/instagram'

const faDigits = (n: number) => String(n).replace(/\d/g, (d) => '۰۱۳۴۵۶۷۸۹'[+d])

function tehranDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(d)
}
async function getSet(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}
async function setSet(k: string, v: string) {
  await prisma.setting.upsert({ where: { key: k }, update: { value: v }, create: { key: k, value: v } })
}

// runs once per day: pick 5 random never-sent prompts, spread across the day
export async function buildDaily5(test = false) {
  const today = tehranDate(0)
  if (test) {
    await prisma.scheduledPost.deleteMany({ where: { day: today, target: { in: ['daily5tg', 'daily5ig'] }, sent: false } }).catch(() => {})
  } else {
    const existing = await prisma.scheduledPost.count({ where: { day: today, target: 'daily5tg' } })
    if (existing > 0) return { built: false, existing }
  }

  // retire old top-24 queue
  await prisma.scheduledPost.updateMany({ where: { target: { in: ['telegram', 'instagram'] }, sent: false }, data: { sent: true } }).catch(() => {})

  let sentIds: string[] = []
  try { sentIds = JSON.parse((await getSet('daily5_sent_ids', '[]')) || '[]') } catch {}

  let pool = await prisma.prompt.findMany({
    where: { status: 'PUBLISHED', NOT: { id: { in: sentIds } } },
    select: { id: true },
    take: 500,
  })
  if (pool.length < 5) {
    sentIds = []
    await setSet('daily5_sent_ids', '[]')
    pool = await prisma.prompt.findMany({ where: { status: 'PUBLISHED' }, select: { id: true }, take: 500 })
  }

  const picked = pool.sort(() => Math.random() - 0.5).slice(0, 5)

  const data: any[] = []
  picked.forEach((p, i) => {
    const dt = test ? new Date(Date.now() + i * 120000) : new Date(Date.now() + (i * 4 + 1) * 3600000)
    data.push({ promptId: p.id, sendAt: dt, day: today, target: 'daily5tg' })
    data.push({ promptId: p.id, sendAt: dt, day: today, target: 'daily5ig' })
  })
  await prisma.scheduledPost.createMany({ data })
  await setSet('daily5_sent_ids', JSON.stringify([...sentIds, ...picked.map((p) => p.id)]))

  return { built: true, count: picked.length }
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
    if (r.ok) {
      const b = Buffer.from(await r.arrayBuffer())
      if (b.length > 1000) return b
    }
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

async function directPhoto(promptId: string, fallback: string): Promise<string> {
  try {
    const row = await prisma.promptImage.findUnique({ where: { promptId } })
    if (row?.type === 'tg') {
      const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
      const g = await (await fetch('https://api.telegram.org/bot' + token + '/getFile?file_id=' + encodeURIComponent(row.data), { signal: AbortSignal.timeout(8000) })).json()
      if (g?.result?.file_path) return 'https://api.telegram.org/file/bot' + token + '/' + g.result.file_path
    }
  } catch {}
  return fallback
}

export async function sendDueDaily5() {
  const due = await prisma.scheduledPost.findMany({
    where: { target: { in: ['daily5tg', 'daily5ig'] }, sent: false, sendAt: { lte: new Date() } },
    orderBy: { sendAt: 'asc' },
    take: 2,
  })
  const done: string[] = []

  for (const d of due) {
    const p = await prisma.prompt.findUnique({ where: { id: d.promptId } })
    if (!p) {
      await prisma.scheduledPost.update({ where: { id: d.id }, data: { sent: true } })
      continue
    }

    if (d.target === 'daily5tg') {
      const out = process.env.TELEGRAM_OUTPUT
      if (out) {
        const tagLine = (p.tagsFa ?? []).map((t: string) => '#' + t.replace(/\s+/g, '_')).join(' ')
        const footer = tagLine + '\n\nPROMPTSFA.IR\n@Prompts_fa'
        const buf = await photoBuffer(p.id, p.img)
        if (buf) await tgPhotoBytes(out, buf, '✨ ' + p.titleFa + ' ✨').catch(() => {})
        await tgSendCode(out, p.prompt, '\n\n' + footer).catch(() => {})
      }
    } else {
      const n = parseInt(await getSet('ig_counter', '20'), 10)
      const tags = (p.tagsFa ?? []).map((t: string) => '#' + t.replace(/\s+/g, '_')).join(' ')
      const caption =
        tags +
        '\n\nبرای دریافت پرامپت‌های بیشتر به سایت ما مراجعه کنید\n' +
        'برای دریافت این پرامپت ابتدا ما را فالو کرده و سپس عدد ' + faDigits(n) + ' را ارسال کنید.'
      await sendToInstagramCustom(p, caption).catch(() => {})
      await setSet('ig_counter', String(n + 1))
    }

    await prisma.scheduledPost.update({ where: { id: d.id }, data: { sent: true } })
    done.push(d.target + ':' + p.slug)
  }
  return done
}
