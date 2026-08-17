#!/bin/bash
set -e

# ---------- 1) schema: ScheduledPost ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'prisma/schema.prisma'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('model ScheduledPost')) {
  s += '\nmodel ScheduledPost {\n  id       String   @id @default(cuid())\n  promptId String\n  target   String\n  sendAt   DateTime\n  sent     Boolean  @default(false)\n  day      String\n}\n'
  fs.writeFileSync(p, s)
  console.log('✅ schema: ScheduledPost')
} else console.log('⚠️ exists')
NODEEOF

# ---------- 2) instagram lib (ready for later config) ----------
cat > src/lib/instagram.ts << 'EOF'
export async function sendToInstagram(p: any) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  const igUserId = process.env.INSTAGRAM_USER_ID
  if (!token || !igUserId) return { skipped: 'instagram not configured yet' }
  if (!p) return { skipped: 'no prompt' }

  const caption =
    '✨ ' + p.titleFa + '\n\n📘 ' + (p.usageFa ?? '') + '\n\n' +
    (p.tagsFa ?? []).map((t: string) => '#' + t.replace(/\s+/g, '_')).join(' ') +
    '\n\n@Prompts_fa'

  try {
    const create = await (await fetch('https://graph.facebook.com/v19.0/' + igUserId + '/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: p.img, caption, media_type: 'IMAGE', access_token: token }),
      signal: AbortSignal.timeout(20000),
    })).json()
    if (!create.id) return { error: create.error?.message ?? 'create failed' }

    await new Promise((r) => setTimeout(r, 4000))

    const publish = await (await fetch('https://graph.facebook.com/v19.0/' + igUserId + '/media_publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: create.id, access_token: token }),
      signal: AbortSignal.timeout(20000),
    })).json()

    return publish.id ? { ok: true, igId: publish.id } : { error: publish.error?.message ?? 'publish failed' }
  } catch (e: any) {
    return { error: String(e?.message ?? e) }
  }
}
EOF

# ---------- 3) schedule lib ----------
cat > src/lib/schedule.ts << 'EOF'
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
EOF

# ---------- 4) article cron builds schedule ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/article/route.ts'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('buildDailySchedule')) {
  s = s.replace(
    "import { isCronAuthorized } from '@/lib/cron-auth'",
    "import { isCronAuthorized } from '@/lib/cron-auth'\nimport { buildDailySchedule } from '@/lib/schedule'"
  )
  s = s.replace(
    'const { searchParams } = new URL(req.url)',
    "const { searchParams } = new URL(req.url)\n  const schedule = await buildDailySchedule().catch(() => null)"
  )
  s = s.replace(/return NextResponse.json\(\{ ok: true, slug/, "return NextResponse.json({ schedule, ok: true, slug")
  fs.writeFileSync(p, s)
  console.log('✅ article: builds daily schedule')
} else console.log('⚠️ already')
NODEEOF

# ---------- 5) telegram cron sends due items ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/telegram/route.ts'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('sendDueTelegram')) {
  s = s.replace(
    "import { isCronAuthorized } from '@/lib/cron-auth'",
    "import { isCronAuthorized } from '@/lib/cron-auth'\nimport { sendDueTelegram, sendDueInstagram } from '@/lib/schedule'"
  )
  s = s.replace(
    "if (!posts.length) return NextResponse.json({ ok: true, phase: 'idle', offset })",
    "if (!posts.length) {\n    const scheduledTg = await sendDueTelegram().catch(() => [])\n    const scheduledIg = await sendDueInstagram().catch(() => [])\n    return NextResponse.json({ ok: true, phase: 'idle', offset, scheduledTg, scheduledIg })\n  }"
  )
  s = s.replace(
    /return NextResponse.json\(\{ ok: true, phase: 'processed'/,
    "await sendDueTelegram().catch(() => [])\n  await sendDueInstagram().catch(() => [])\n  return NextResponse.json({ ok: true, phase: 'processed'"
  )
  fs.writeFileSync(p, s)
  console.log('✅ telegram cron: sends due scheduled posts')
} else console.log('⚠️ already')
NODEEOF

echo "✅ update80 done!"