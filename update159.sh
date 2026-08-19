#!/bin/bash
set -e

echo "===== حذف orderBy از کوئری‌های Like ====="

# ---------- 1) Fix debug API ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/debug/full-check/route.ts'
let s = fs.readFileSync(p, 'utf8')

// Remove orderBy from like query
s = s.replace(
  /prisma\.like\.findMany\(\{\s*where: \{ userId \},\s*include: \{ prompt: \{ select: \{ titleFa: true, slug: true \} \} \},\s*orderBy: \{ createdAt: 'desc' \},\s*take: 10\s*\}/,
  `prisma.like.findMany({ 
        where: { userId }, 
        include: { prompt: { select: { titleFa: true, slug: true } } },
        take: 10
      })`
)

fs.writeFileSync(p, s)
console.log('✅ Debug API: removed orderBy from Like query')
NODEEOF

# ---------- 2) Fix account page ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/account/page.tsx'
let s = fs.readFileSync(p, 'utf8')

// Remove orderBy from like query in account page
s = s.replace(
  /const likes = await prisma\.like\.findMany\(\{\s*where: \{ userId: session\.user\.id \},\s*include: \{ prompt: \{ include: \{ category: true \} \} \},\s*orderBy: \{ createdAt: 'desc' \},\s*take: 20,\s*\}\)/,
  `const likes = await prisma.like.findMany({
      where: { userId: session.user.id },
      include: { prompt: { include: { category: true } } },
      take: 20,
    })`
)

fs.writeFileSync(p, s)
console.log('✅ Account page: removed orderBy from Like query')
NODEEOF

echo "✅ update159 done!"