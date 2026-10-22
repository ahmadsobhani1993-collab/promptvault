export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'
import { sendToInstagramCustom } from '@/lib/instagram'
import { faDigits } from '@/lib/fa-digits'

export const maxDuration = 60

async function getSet(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}
async function setSet(k: string, v: string) {
  await prisma.setting.upsert({ where: { key: k }, update: { value: v }, create: { key: k, value: v } })
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let sentIds: string[] = []
  try { sentIds = JSON.parse(await getSet('hourly_sent_ids', '[]')) } catch {}

  let pool = await prisma.prompt.findMany({
    where: { status: 'PUBLISHED', NOT: { id: { in: sentIds } } },
    select: { id: true },
    take: 500,
  })

  if (pool.length === 0) {
    sentIds = []
    await setSet('hourly_sent_ids', '[]')
    pool = await prisma.prompt.findMany({ where: { status: 'PUBLISHED' }, select: { id: true }, take: 500 })
  }

  if (pool.length === 0) return NextResponse.json({ ok: true, skipped: 'no prompts' })

  const pick = pool[Math.floor(Math.random() * pool.length)]
  const p = await prisma.prompt.findUnique({ where: { id: pick.id }, include: { category: true } })
  if (!p) return NextResponse.json({ ok: true, skipped: 'not found' })

  const tagLine = (p.tagsFa ?? []).map((t: string) => '#' + t.replace(/\s+/g, '_')).join(' ')
  const app = process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'
  const slugLink = app + '/prompts/' + p.slug

  const n = parseInt(await getSet('ig_counter', '20'), 10)
  
  // کپشن ساده، صریح و بدون متن‌های زائد
  const igCaption = `${p.titleFa}\n\n${slugLink}\n\n${tagLine}\n\nکد: ${faDigits(n)}`

  await sendToInstagramCustom(p, igCaption).catch(() => {})
  await setSet('ig_counter', String(n + 1))
  await setSet('hourly_sent_ids', JSON.stringify([...sentIds, p.id]))

  return NextResponse.json({ ok: true, slug: p.slug, sentTo: ['instagram'], igNumber: n })
}
