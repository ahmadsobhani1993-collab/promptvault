#!/bin/bash
set -e

# ---------- vercel.json (دو کرون) ----------
cat > vercel.json << 'EOF'
{
  "crons": [
    {
      "path": "/api/cron/telegram",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/article",
      "schedule": "30 5 * * *"
    }
  ]
}
EOF

# ---------- helper: auth check ----------
cat > src/lib/cron-auth.ts << 'EOF'
export function isCronAuthorized(req: Request): boolean {
  const { searchParams } = new URL(req.url)
  const ua = req.headers.get('user-agent') ?? ''
  const auth = req.headers.get('authorization')
  const key = searchParams.get('key')

  // 1) Vercel Cron (User-Agent = vercel-cron/1.0)
  if (ua.includes('vercel-cron')) return true

  // 2) Authorization: Bearer <CRON_SECRET>
  if (process.env.CRON_SECRET && auth === 'Bearer ' + process.env.CRON_SECRET) return true

  // 3) ?key=<CRON_SECRET>  (دستی / cron-job.org)
  if (process.env.CRON_SECRET && key === process.env.CRON_SECRET) return true

  return false
}
EOF

# ---------- patch /api/cron/telegram ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/telegram/route.ts'
let s = fs.readFileSync(p, 'utf8')

// add import
if (!s.includes('isCronAuthorized')) {
  s = "import { isCronAuthorized } from '@/lib/cron-auth'\n" + s
}

// replace auth block
const oldBlock = `const authHeader = req.headers.get('authorization')
  const validAuth = authHeader === 'Bearer ' + process.env.CRON_SECRET
  const validKey = searchParams.get('key') === process.env.CRON_SECRET

  if (!validAuth && !validKey) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }`

const oldBlockAlt = `const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }`

if (s.includes(oldBlock)) {
  s = s.replace(oldBlock, `if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })`)
  console.log('✅ telegram: auth patched')
} else if (s.includes(oldBlockAlt)) {
  s = s.replace(oldBlockAlt, `if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })`)
  console.log('✅ telegram: auth patched (alt)')
} else if (s.includes('isCronAuthorized(req)')) {
  console.log('⚠️ telegram already patched')
} else {
  console.log('❌ telegram: pattern not found')
}

fs.writeFileSync(p, s)
NODEEOF

# ---------- patch /api/cron/article ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/article/route.ts'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('isCronAuthorized')) {
  s = "import { isCronAuthorized } from '@/lib/cron-auth'\n" + s
}

const oldBlock = `const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }`

if (s.includes(oldBlock)) {
  s = s.replace(oldBlock, `if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })`)
  console.log('✅ article: auth patched')
} else if (s.includes('isCronAuthorized(req)')) {
  console.log('⚠️ article already patched')
} else {
  console.log('❌ article: pattern not found')
}

fs.writeFileSync(p, s)
NODEEOF

echo "✅ Cron auth fixed + vercel.json ready!"