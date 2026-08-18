#!/bin/bash
set -e

# ---------- 1) daily5: test mode + immediate first send ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/daily5.ts'
let s = fs.readFileSync(p, 'utf8')

s = s.replace('export async function buildDaily5() {', 'export async function buildDaily5(test = false) {')

s = s.replace(
  `  const existing = await prisma.scheduledPost.count({ where: { day: today, target: 'daily5tg' } })
  if (existing > 0) return { built: false, existing }`,
  `  if (test) {
    await prisma.scheduledPost.deleteMany({ where: { day: today, target: { in: ['daily5tg', 'daily5ig'] }, sent: false } }).catch(() => {})
  } else {
    const existing = await prisma.scheduledPost.count({ where: { day: today, target: 'daily5tg' } })
    if (existing > 0) return { built: false, existing }
  }`
)

s = s.replace(
  'const dt = new Date(Date.now() + (i * 4 + 1) * 3600000)',
  'const dt = test ? new Date(Date.now() + i * 120000) : new Date(Date.now() + (i * 4 + 1) * 3600000)'
)

fs.writeFileSync(p, s)
console.log('✅ daily5: test mode')
NODEEOF

# ---------- 2) article route: pass test + REMOVE article TG send ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/article/route.ts'
let s = fs.readFileSync(p, 'utf8')

s = s.replace(
  'const schedule = await buildDaily5().catch(() => null)',
  "const schedule = await buildDaily5(searchParams.get('test') === '1').catch(() => null)"
)

// remove original TG send block if still present
s = s.replace(/const hour = parseInt\([\s\S]*?\n  \}/, '  const tg = null')
s = s.replace('const tg = null // sent on admin approve', '  const tg = null')

fs.writeFileSync(p, s)
console.log('✅ article: no TG send; test param wired')
console.log('--- tgSendText occurrences left in article route: ' + (s.match(/tgSendText/g) || []).length)
NODEEOF

# ---------- 3) admin publish: no TG send ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/admin/articles/route.ts'
let s = fs.readFileSync(p, 'utf8')
s = s.replace(/const out = process\.env\.TELEGRAM_OUTPUT\n\s*if \(out\) await tgSendText\(out,[\s\S]*?\)\.catch\(\(\) => \{\}\)\n/, '')
fs.writeFileSync(p, s)
console.log('✅ admin publish: no TG send')
NODEEOF

echo "✅ update121 done!"