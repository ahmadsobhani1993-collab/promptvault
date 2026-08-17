import { prisma } from '@/lib/db'
import { tgSendPhoto, tgSendCode } from '@/lib/telegram'
import { sendToInstagram } from '@/lib/instagram'

function tehranDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(d)
}

// runs once per day (with the article cron at Tehran midnight)
export async function buildDailySchedule() {
  const today = tehranDate(0)
  const existing = await prisma.scheduledPost.count({ where: { day: today } })
  if (existing > 0) return { built: false, existing }

  const yesterday = tehranDate(-1)
  let pool = await prisma.prompt.findMany({
    where: {
      status: 'PUBLISHED',
      createdAt: { gte: new Date(yesterday + 'T00:00:00Z'), lt: new Date(today + 'T00:00:00Z') },
    },
    orderBy: { views: 'desc' },
    take: 24,
  })

  if (pool.length < 24) {
    const ids = pool.map((p) => p.id)
    const fill = await prisma.prompt.findMany({
      where: { status: 'PUBLISHED', NOT: { id: { in: ids } } },
      orderBy: { views: 'desc' },
      take: 24 - pool.length,
    })
    pool = pool.concat(fill)
  }

  const data: any[] = []
  pool.forEach((p, i) => {
    const dt = new Date(Date.now() + i * 3600000)
    data.push({ promptId: p.id, sendAt: dt, day: today, target: 'telegram' })
    data.push({ promptId: p.id, sendAt: dt, day: today, target: 'instagram' })
  })
  await prisma.scheduledPost.createMany({ data })

  // cleanup old
  await prisma.scheduledPost.deleteMany({ where: { day: { lt: tehranDate(-2) } } }).catch(() => {})

  return { built: true, count: pool.length }
}

export async function sendDueTelegram() {
  const due = await prisma.scheduledPost.findMany({
    where: { target: 'telegram', sent: false, sendAt: { lte: new Date() } },
    orderBy: { sendAt: 'asc' },
    take: 1,
  })
  const sentSlugs: string[] = []
  for (const d of due) {
    const p = await prisma.prompt.findUnique({ where: { id: d.promptId } })
    if (!p) {
      await prisma.scheduledPost.update({ where: { id: d.id }, data: { sent: true } })
      continue
    }
    const out = process.env.TELEGRAM_OUTPUT
    if (out) {
      const tagLine = (p.tagsFa ?? []).map((t) => '#' + t.replace(/\s+/g, '_')).join(' ')
      const usageFa = (p.usageFa ?? '').trim()
      const full = '✨ ' + p.titleFa + '\n\n📘 ' + usageFa + '\n\n📝 ' + p.prompt + '\n\n' + tagLine + '\n\n@Prompts_fa'
      const short = '✨ ' + p.titleFa + '\n\n📘 ' + usageFa + '\n\n' + tagLine + '\n\n@Prompts_fa'
      if (full.length <= 1024) await tgSendPhoto(out, p.img, full)
      else {
        await tgSendPhoto(out, p.img, short)
        await tgSendCode(out, p.prompt, '\n\n@Prompts_fa')
      }
    }
    await prisma.scheduledPost.update({ where: { id: d.id }, data: { sent: true } })
    sentSlugs.push(p.slug)
  }
  return sentSlugs
}

export async function sendDueInstagram() {
  const due = await prisma.scheduledPost.findMany({
    where: { target: 'instagram', sent: false, sendAt: { lte: new Date() } },
    orderBy: { sendAt: 'asc' },
    take: 1,
  })
  const results: any[] = []
  for (const d of due) {
    const p = await prisma.prompt.findUnique({ where: { id: d.promptId } })
    results.push(await sendToInstagram(p))
    await prisma.scheduledPost.update({ where: { id: d.id }, data: { sent: true } })
  }
  return results
}
