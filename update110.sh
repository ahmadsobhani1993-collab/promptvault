#!/bin/bash
set -e

mkdir -p src/app/api/debug/article-schema

cat > src/app/api/debug/article-schema/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'
import fs from 'fs'
import path from 'path'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // 1) read schema and extract Article model fields
  let schemaText = ''
  try {
    schemaText = fs.readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
  } catch {}
  const m = schemaText.match(/model Article \{([\s\S]*?)\n\}/)
  const fields: string[] = []
  if (m) {
    const lines = m[1].split('\n')
    for (const ln of lines) {
      const f = ln.trim().match(/^(\w+)\s+(\w+)/)
      if (f) fields.push(f[1] + ':' + f[2])
    }
  }

  // 2) try minimal create variations
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date())
  const slugBase = 'dbg-' + Date.now()
  const tries: any[] = []

  const variations = [
    { name: 'minimal', data: { titleFa: 't', slug: slugBase + '-1' } },
    { name: '+titleEn', data: { titleFa: 't', titleEn: 't', slug: slugBase + '-2' } },
    { name: '+desc', data: { titleFa: 't', titleEn: 't', descFa: 'd', descEn: 'd', slug: slugBase + '-3' } },
    { name: '+img', data: { titleFa: 't', slug: slugBase + '-4', img: 'https://x/y.jpg' } },
    { name: '+content', data: { titleFa: 't', slug: slugBase + '-5', contentFa: 'c', contentEn: 'c' } },
    { name: '+tag', data: { titleFa: 't', slug: slugBase + '-6', tagFa: 'ai', tagEn: 'ai' } },
    { name: 'full', data: { titleFa: 't', titleEn: 't', descFa: 'd', descEn: 'd', contentFa: 'c', contentEn: 'c', img: 'https://x/y.jpg', tagFa: 'ai', tagEn: 'ai', slug: slugBase + '-7' } },
  ]

  for (const v of variations) {
    try {
      const a = await prisma.article.create({ data: v.data as any })
      tries.push({ name: v.name, ok: true, id: a.id })
    } catch (e: any) {
      tries.push({ name: v.name, ok: false, error: String(e?.message ?? e).slice(-400) })
    }
  }

  // cleanup debug rows
  await prisma.article.deleteMany({ where: { slug: { startsWith: 'dbg-' } } }).catch(() => {})

  return NextResponse.json({ ok: true, fields, tries })
}
EOF

echo "✅ update110 done!"