#!/bin/bash
set -e

mkdir -p src/app/api/debug/tg-send-test

# ---------- 1) admin: responsive layout ----------
node << 'NODEEOF'
const fs = require('fs')
const files = [
  'src/app/admin/page.tsx',
  'src/app/admin/prompts/page.tsx',
  'src/app/admin/articles/page.tsx',
  'src/app/admin/categories/page.tsx',
  'src/app/admin/comments/page.tsx',
  'src/app/admin/users/page.tsx',
]
for (const p of files) {
  if (!fs.existsSync(p)) continue
  let s = fs.readFileSync(p, 'utf8')
  const before = s
  s = s.replace(/grid-cols-\[\d+px_1fr\]/g, 'grid-cols-1 lg:grid-cols-[220px_1fr]')
  s = s.replace(/grid-cols-\[1fr_\d+px\]/g, 'grid-cols-1 lg:grid-cols-[1fr_220px]')
  if (s !== before) { fs.writeFileSync(p, s); console.log('✅ ' + p + ': responsive grid') }
}
NODEEOF

# ---------- 2) header submit button fix ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/header.tsx'
let s = fs.readFileSync(p, 'utf8')
s = s.replace(/<Link href="\/submit" className="btn-primary([^"]*)">\s*\+?\s*\{L\(locale, 'ارسال', 'Submit'\)\}/g, "<Link href=\"/submit\" className=\"btn-primary$1 whitespace-nowrap\">{L(locale, 'ارسال', 'Submit')}")
fs.writeFileSync(p, s)
console.log('✅ header: submit button fixed')
NODEEOF

# ---------- 3) telegram send test ----------
cat > src/app/api/debug/tg-send-test/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { tgSendPhoto, tgSendText } from '@/lib/telegram'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const out = process.env.TELEGRAM_OUTPUT
  if (!out) return NextResponse.json({ error: 'TELEGRAM_OUTPUT not set' }, { status: 500 })

  const text = await tgSendText(out, '✅ تست ارسال PromptsFA — ' + new Date().toLocaleString('fa-IR'))

  const p = await prisma.prompt.findFirst({ where: { status: 'PUBLISHED' }, orderBy: { createdAt: 'desc' }, select: { img: true, titleFa: true } })
  const photo = p ? await tgSendPhoto(out, p.img, '📷 ' + p.titleFa + '\n\n🔗 @Prompts_fa') : { error: 'no prompt' }

  return NextResponse.json({ output: out, textResult: text, photoResult: photo })
}
EOF

echo "✅ update75 done!"