import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { tgSendPhoto } from '@/lib/telegram'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 30

const TG_FOOTER = '\n\n🔗 @Prompts_fa'
const APP = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'

async function getSetting(key: string, def: string) {
  return (await prisma.setting.findUnique({ where: { key } }))?.value ?? def
}
async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const out = process.env.TELEGRAM_OUTPUT
  if (!out) return NextResponse.json({ error: 'no output channel' }, { status: 500 })

  const hour = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: 'numeric', hour12: false }).format(new Date()), 10)
  if (hour < 12 || hour > 23) return NextResponse.json({ ok: true, skipped: 'outside window', hour })

  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date())
  const sentDate = await getSetting('bc_sent_date', '')
  const sent = sentDate === date ? parseInt(await getSetting('bc_sent_count', '0'), 10) : 0
  if (sent >= 20) return NextResponse.json({ ok: true, skipped: 'daily cap 20 reached', sent })

  const recent = (await getSetting('bc_recent', '')).split(',').filter(Boolean)
  const pool = await prisma.prompt.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    take: 150,
    select: { id: true, slug: true, titleFa: true, usageFa: true, tagsFa: true, img: true },
  })
  const candidates = pool.filter((p) => !recent.includes(p.id))
  const list = candidates.length ? candidates : pool
  const pick = list[Math.floor(Math.random() * list.length)]
  if (!pick) return NextResponse.json({ ok: true, skipped: 'no prompts' })

  const tagLine = (pick.tagsFa ?? []).map((t) => '#' + t.replace(/\s+/g, '_')).join(' ')
  const url = APP() + '/prompts/' + pick.slug
  const caption = '✨ ' + pick.titleFa + '\n\n📘 ' + (pick.usageFa ?? '') + '\n\n' + tagLine + '\n\n🌐 ' + url + TG_FOOTER

  const r = await tgSendPhoto(out, pick.img, caption)

  await setSetting('bc_sent_date', date)
  await setSetting('bc_sent_count', String(sent + 1))
  await setSetting('bc_recent', [pick.id, ...recent].slice(0, 60).join(','))

  return NextResponse.json({ ok: true, sent: sent + 1, slug: pick.slug, tg: r })
}
