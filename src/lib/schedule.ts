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

export async function sendDueTelegram() { return [] }

export async function sendDueInstagram() { return [] }

async function getSet(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}
async function setSet(k: string, v: string) {
  await prisma.setting.upsert({ where: { key: k }, update: { value: v }, create: { key: k, value: v } })
}

// if no article today, try every 30 min (via the 5-min telegram cron)
export async function ensureDailyArticle(appUrl: string) {
  try {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date())
    const start = new Date(today + 'T00:00:00+03:30')
    const count = await prisma.article.count({ where: { createdAt: { gte: start } } })
    if (count > 0) return false
    const last = parseInt(await getSet('article_last_attempt', '0'), 10)
    if (Date.now() - last < 30 * 60000) return false
    await setSet('article_last_attempt', String(Date.now()))
    const key = process.env.CRON_SECRET ?? ''
    fetch(appUrl + '/api/cron/article?key=' + key + '&step=1', { signal: AbortSignal.timeout(8000) }).catch(() => {})
    return true
  } catch {
    return false
  }
}
