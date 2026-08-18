#!/bin/bash
set -e

# ---------- 1) disable old senders ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/schedule.ts'
let s = fs.readFileSync(p, 'utf8')

s = s.replace(/export async function sendDueTelegram\([^)]*\)[^{]*\{/, (m) => m + '\n  return [] // disabled — daily5 replaced it')
s = s.replace(/export async function sendDueInstagram\([^)]*\)[^{]*\{/, (m) => m + '\n  return [] // disabled — daily5 replaced it')

fs.writeFileSync(p, s)
console.log('✅ old senders disabled')
NODEEOF

# ---------- 2) daily5: purge old queue rows ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/daily5.ts'
let s = fs.readFileSync(p, 'utf8')

s = s.replace(
  "await prisma.scheduledPost.updateMany({ where: { target: { in: ['telegram', 'instagram'] }, sent: false }, data: { sent: true } }).catch(() => {})",
  "await prisma.scheduledPost.deleteMany({ where: { NOT: { target: { in: ['daily5tg', 'daily5ig'] } } } }).catch(() => {})"
)

fs.writeFileSync(p, s)
console.log('✅ old queue purged on next build')
NODEEOF

echo "✅ update123 done!"