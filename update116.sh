#!/bin/bash
set -e

# ---------- 1) schema: Article status ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'prisma/schema.prisma'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('status') || !/model Article \{[\s\S]*?status/.test(s)) {
  s = s.replace(/model Article \{(\n\s+id\s+String)/, "model Article {$1")
  s = s.replace(/(model Article \{\n)/, "$1  status    String   @default(\"PUBLISHED\")\n")
  fs.writeFileSync(p, s)
  console.log('✅ schema: Article.status added')
} else console.log('⚠️ status exists')
NODEEOF

# ---------- 2) gemini: dedupe repeated first word in titles ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/gemini.ts'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('cleanTitle')) {
  s = s.replace(
    'return {',
    "const cleanTitle = (t: string) => t.replace(/^([\\u0600-\\u06FF\\w]+)\\s+\\1/, '$1')\n  return {"
  )
  s = s.replace(/titleFa: parsed\.titleFa \|\| 'پرامپت هوش مصنوعی',/, "titleFa: cleanTitle(String(parsed.titleFa || 'پرامپت هوش مصنوعی')),")
  s = s.replace(/titleEn: parsed\.titleEn \|\| 'AI Prompt',/, "titleEn: cleanTitle(String(parsed.titleEn || 'AI Prompt')),")
  fs.writeFileSync(p, s)
  console.log('✅ gemini: title dedupe')
} else console.log('⚠️ already')
NODEEOF

# ---------- 3) article route: 1/day + topic diversity + PENDING ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/article/route.ts'
let s = fs.readFileSync(p, 'utf8')

// one article per day max
if (!s.includes('skipped')) {
  s = s.replace(
    "const schedule = await buildDailySchedule().catch(() => null)",
    "const schedule = await buildDailySchedule().catch(() => null)\n    const todayStart = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date()) + 'T00:00:00+03:30')\n    const todayCount = await prisma.article.count({ where: { createdAt: { gte: todayStart } } })\n    if (todayCount > 0) return NextResponse.json({ ok: true, skipped: 'article exists today', schedule })"
  )
}

// topic diversity
if (!s.includes('recentTopics')) {
  s = s.replace(
    "try { raw = (await generateText({ instruction: INSTRUCTION })).text }",
    "const recent = await prisma.article.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { titleFa: true, tagFa: true } })\n    const recentTopics = recent.map((r) => r.titleFa).join('، ')\n    const instruction = INSTRUCTION + '\\n9) موضوعاتی که قبلاً پوشش داده شده و تکرارشان ممنوع است: ' + recentTopics + '\\n10) موضوع جدید باید کاملاً متفاوت از لیست بالا باشد.'\n    try { raw = (await generateText({ instruction })).text }"
  )
}

// create as PENDING
if (!s.includes("status: 'PENDING'")) {
  s = s.replace(/contentFa: contentFa\.split[\s\S]*?contentEn: contentEn\.split[^\n]*\n/, (m) => m + "        status: 'PENDING',\n")
}

// remove auto TG send (will send on approve)
s = s.replace(/const hour = parseInt[\s\S]*?tg = await tgSendText\(out,[^)]*\)\.catch\(\(\) => null\)\n  \}/, "const tg = null // sent on admin approve")

fs.writeFileSync(p, s)
console.log('✅ article: 1/day + diversity + PENDING')
NODEEOF

# ---------- 4) public blog: only PUBLISHED ----------
node << 'NODEEOF'
const fs = require('fs')
const path = require('path')

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    const st = fs.statSync(p)
    if (st.isDirectory()) { if (!p.includes('/admin')) walk(p, out) }
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

for (const p of walk('src/app')) {
  let s = fs.readFileSync(p, 'utf8')
  if (!s.includes('prisma.article.findMany')) continue
  if (s.includes('status:')) continue
  s = s.replace(/prisma\.article\.findMany\(\{\s*/, "prisma.article.findMany({ where: { status: 'PUBLISHED' }, ")
  fs.writeFileSync(p, s)
  console.log('✅ published-only: ' + p)
}

// blog detail: notFound if not published
const bp = 'src/app/blog/[slug]/page.tsx'
if (fs.existsSync(bp)) {
  let s = fs.readFileSync(bp, 'utf8')
  if (!s.includes("status !== 'PUBLISHED'")) {
    s = s.replace(/const (\w+) = await prisma\.article\.findUnique\([^)]*\)/, (m, v) => m + "\n  if (!" + v + " || " + v + ".status !== 'PUBLISHED') notFound()")
    if (!s.includes('notFound')) s = s.replace(/import \{ redirect \}/, "import { redirect, notFound }")
    if (!s.includes('next/navigation')) s = "import { notFound } from 'next/navigation'\n" + s
    fs.writeFileSync(bp, s)
    console.log('✅ blog detail: notFound for pending')
  }
}
NODEEOF

# ---------- 5) admin nav: analytics link ----------
node << 'NODEEOF'
const fs = require('fs')
const files = ['src/app/admin/page.tsx','src/app/admin/prompts/page.tsx','src/app/admin/categories/page.tsx','src/app/admin/comments/page.tsx','src/app/admin/users/page.tsx']
for (const p of files) {
  if (!fs.existsSync(p)) continue
  let s = fs.readFileSync(p, 'utf8')
  if (s.includes('/admin/analytics')) continue
  if (s.includes("/admin/prompts'")) {
    s = s.replace(/\{\s*href:\s*'\/admin\/prompts'/, "{ href: '/admin/analytics', label: '📊 آمار بازدید' },\n    { href: '/admin/prompts'")
    fs.writeFileSync(p, s)
    console.log('✅ nav: ' + p)
  }
}
NODEEOF

# ---------- 6) article review UI ----------
cat > src/components/article-actions.tsx << 'EOF'
'use client'

import { useRouter } from 'next/navigation'

export default function ArticleActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const act = async (action: string) => {
    await fetch('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    router.refresh()
  }
  return (
    <div className="flex shrink-0 gap-2">
      {status !== 'PUBLISHED' && (
        <button onClick={() => act('publish')} className="rounded-full bg-green-500/15 px-3 py-1 text-[10px] text-green-400 transition-colors hover:bg-green-500/25">✅ انتشار</button>
      )}
      {status === 'PUBLISHED' && (
        <button onClick={() => act('unpublish')} className="rounded-full bg-yellow-500/15 px-3 py-1 text-[10px] text-yellow-400 transition-colors hover:bg-yellow-500/25">توقف</button>
      )}
      <button onClick={() => act('delete')} className="rounded-full bg-red-500/15 px-3 py-1 text-[10px] text-red-400 transition-colors hover:bg-red-500/25">حذف</button>
    </div>
  )
}
EOF

mkdir -p src/app/api/admin/articles
cat > src/app/api/admin/articles/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { tgSendText } from '@/lib/telegram'

export async function POST(req: Request) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { id, action } = await req.json()

  if (action === 'delete') {
    await prisma.article.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  }
  if (action === 'publish') {
    const a = await prisma.article.update({ where: { id }, data: { status: 'PUBLISHED' } })
    const out = process.env.TELEGRAM_OUTPUT
    if (out) await tgSendText(out, '📚 ' + a.titleFa + '\n\n🔗 ' + (process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir') + '/blog/' + a.slug).catch(() => {})
    return NextResponse.json({ ok: true })
  }
  if (action === 'unpublish') {
    await prisma.article.update({ where: { id }, data: { status: 'PENDING' } })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'bad action' }, { status: 400 })
}
EOF

cat > src/app/admin/articles/page.tsx << 'EOF'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import ArticleActions from '@/components/article-actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'مقالات | مدیریت' }

export default async function AdminArticles() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  const rows = await prisma.article.findMany({ orderBy: { createdAt: 'desc' }, take: 60 })

  return (
    <section className="container-app py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">📚 مقالات ({rows.length})</h1>
        <Link href="/admin" className="btn-secondary text-xs">← داشبورد</Link>
      </div>
      <p className="mt-2 text-xs text-ink-muted">مقالات هوش مصنوعی ابتدا «در انتظار» می‌مانند؛ پس از بازبینی، انتشار بزن.</p>

      <div className="card mt-6 overflow-hidden">
        <div className="divide-y divide-line">
          {rows.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link href={'/blog/' + a.slug} className="block truncate text-xs font-bold text-ink transition-colors hover:text-gold-bright">{a.titleFa}</Link>
                <p className="mt-1 text-[10px] text-ink-faint">
                  {new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium' }).format(a.createdAt)}
                  {' · '}{a.tagFa}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={'rounded-full px-2 py-0.5 text-[9px] ' + (a.status === 'PUBLISHED' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400')}>
                  {a.status === 'PUBLISHED' ? 'منتشر' : 'در انتظار'}
                </span>
                <ArticleActions id={a.id} status={a.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
EOF
echo "✅ article review workflow ready"

# ---------- 7) fix duplicated titles in DB ----------
mkdir -p src/app/api/debug/fix-titles
cat > src/app/api/debug/fix-titles/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const rows = await prisma.prompt.findMany({ select: { id: true, titleFa: true, titleEn: true } })
  const re = /^(\S+)\s+\1/
  let fixed = 0
  for (const r of rows) {
    const fa = re.test(r.titleFa) ? r.titleFa.replace(re, '$1') : r.titleFa
    const en = re.test(r.titleEn) ? r.titleEn.replace(re, '$1') : r.titleEn
    if (fa !== r.titleFa || en !== r.titleEn) {
      await prisma.prompt.update({ where: { id: r.id }, data: { titleFa: fa, titleEn: en } })
      fixed++
    }
  }
  return NextResponse.json({ ok: true, fixed })
}
EOF
echo "✅ fix-titles route"

echo "✅ update116 done!"