import { prisma } from '@/lib/db'

function tehranDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(d)
}

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
  await prisma.scheduledPost.deleteMany({ where: { day: { lt: tehranDate(-2) } } }).catch(() => {})

  return { built: true, count: pool.length }
}

export async function sendDueTelegram() { return [] }
export async function sendDueInstagram() { return [] }
