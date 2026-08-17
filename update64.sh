#!/bin/bash
set -e

# ---------- 1) schema: separate image table ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'prisma/schema.prisma'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('model PromptImage')) {
  s += '\nmodel PromptImage {\n  promptId String @id\n  data     String\n  type     String?\n  prompt   Prompt @relation(fields: [promptId], references: [id], onDelete: Cascade)\n}\n'
  fs.writeFileSync(p, s)
  console.log('✅ schema: PromptImage added')
} else console.log('⚠️ PromptImage exists')
NODEEOF

# ---------- 2) img route: read from PromptImage first ----------
cat > 'src/app/api/img/[id]/route.ts' << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const row = await prisma.promptImage.findUnique({ where: { promptId: id } })
  if (row?.data) {
    return new Response(Buffer.from(row.data, 'base64'), {
      headers: {
        'Content-Type': row.type ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }

  const p = await prisma.prompt.findUnique({ where: { id }, select: { imgData: true, imgType: true } })
  if (!p?.imgData) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return new Response(Buffer.from(p.imgData, 'base64'), {
    headers: {
      'Content-Type': p.imgType ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
EOF

# ---------- 3) migration route (one-time) ----------
mkdir -p src/app/api/debug/migrate-img
cat > src/app/api/debug/migrate-img/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const rows = await prisma.prompt.findMany({
    where: { NOT: { imgData: null } },
    select: { id: true, imgData: true, imgType: true },
    take: 50,
  })

  let moved = 0
  for (const r of rows) {
    if (!r.imgData) continue
    await prisma.promptImage.upsert({
      where: { promptId: r.id },
      update: {},
      create: { promptId: r.id, data: r.imgData, type: r.imgType },
    })
    await prisma.prompt.update({ where: { id: r.id }, data: { imgData: null, imgType: null } })
    moved++
  }

  const left = await prisma.prompt.count({ where: { NOT: { imgData: null } } })
  return NextResponse.json({ ok: true, moved, left })
}
EOF

# ---------- 4) cron + import: write to PromptImage ----------
node << 'NODEEOF'
const fs = require('fs')

for (const p of ['src/app/api/cron/telegram/route.ts', 'src/app/api/debug/import/route.ts']) {
  let s = fs.readFileSync(p, 'utf8')
  s = s.replace(/imgData: imgBase64, imgType,\n/g, '')
  s = s.replace(
    "await prisma.prompt.update({ where: { id: prompt.id }, data: { img: APP() + '/api/img/' + prompt.id } })",
    "await prisma.prompt.update({ where: { id: prompt.id }, data: { img: APP() + '/api/img/' + prompt.id } })\n      await prisma.promptImage.create({ data: { promptId: prompt.id, data: imgBase64, type: imgType } }).catch(() => {})"
  )
  fs.writeFileSync(p, s)
  console.log('✅ ' + p + ': PromptImage write')
}
NODEEOF

# ---------- 5) route loader: no blocking ----------
cat > src/components/route-loader.tsx << 'EOF'
'use client'

import { useEffect } from 'react'

export default function RouteLoader() {
  useEffect(() => {
    const show = () => document.body.classList.add('route-loading')
    const handler = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a')
      if (!a) return
      const href = a.getAttribute('href') || ''
      if (!href.startsWith('/') || a.target === '_blank' || e.metaKey || e.ctrlKey) return
      show()
    }
    document.addEventListener('click', handler)
    window.addEventListener('pageshow', () => document.body.classList.remove('route-loading'))
    return () => document.removeEventListener('click', handler)
  }, [])

  return (
    <div className="route-loader" aria-hidden="true">
      <div className="route-loader-box">
        <div className="route-spinner" />
        <p className="route-loader-title">Prompts<span>FA</span></p>
        <p className="route-loader-sub">در حال آماده‌سازی...</p>
      </div>
    </div>
  )
}
EOF

# ---------- 6) remove duplicate PWAControls from footer ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/footer.tsx'
let s = fs.readFileSync(p, 'utf8')
if (s.includes('PWAControls')) {
  s = s.replace(/import PWAControls from [^\n]+\n/, '')
  s = s.replace(/<PWAControls \/>/g, '')
  fs.writeFileSync(p, s)
  console.log('✅ footer: duplicate removed')
} else console.log('⚠️ footer clean')
NODEEOF

echo "✅ update64 done!"