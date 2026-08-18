#!/bin/bash
set -e

echo "----- current robots.txt (if any) -----"
cat public/robots.txt 2>/dev/null || echo "(none)"
echo "----------------------------------------"

# ---------- 1) robots: allow all bots ----------
cat > public/robots.txt << 'EOF'
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: https://promptsfa.ir/sitemap.xml
EOF
echo "✅ robots.txt: open for bots"

# ---------- 2) sitemap ----------
cat > src/app/sitemap.ts << 'EOF'
import { type MetadataRoute } from 'next'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://promptsfa.ir'
  const now = new Date()

  const [prompts, articles, cats] = await Promise.all([
    prisma.prompt.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 2000 }),
    prisma.article.findMany({ select: { slug: true, createdAt: true } }),
    prisma.category.findMany({ select: { slug: true } }),
  ])

  const statics: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: base + '/explore', changeFrequency: 'daily', priority: 0.9 },
    { url: base + '/blog', changeFrequency: 'daily', priority: 0.8 },
    { url: base + '/categories', changeFrequency: 'weekly', priority: 0.7 },
  ]

  return [
    ...statics,
    ...cats.map((c) => ({ url: base + '/categories/' + c.slug, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...prompts.map((p) => ({ url: base + '/prompts/' + p.slug, lastModified: p.createdAt, changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...articles.map((a) => ({ url: base + '/blog/' + a.slug, lastModified: a.createdAt, changeFrequency: 'monthly' as const, priority: 0.7 })),
  ]
}
EOF
echo "✅ sitemap.ts created"

# ---------- 3) schema: PageView ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'prisma/schema.prisma'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('model PageView')) {
  s += '\nmodel PageView {\n  id        String   @id @default(cuid())\n  path      String\n  referrer  String?\n  ua        String?\n  ip        String?\n  createdAt DateTime @default(now())\n}\n'
  fs.writeFileSync(p, s)
  console.log('✅ schema: PageView added')
} else console.log('⚠️ PageView exists')
NODEEOF

# ---------- 4) track API ----------
mkdir -p src/app/api/track
cat > src/app/api/track/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const j = await req.json().catch(() => ({}))
    const path = String(j.path ?? '/').slice(0, 300)
    const referrer = String(j.referrer ?? '').slice(0, 500) || null
    const ua = (req.headers.get('user-agent') ?? '').slice(0, 300) || null
    const fwd = req.headers.get('x-forwarded-for') ?? ''
    const ip = fwd.split(',')[0]?.trim() || null
    await prisma.pageView.create({ data: { path, referrer, ua, ip } })
  } catch {}
  return NextResponse.json({ ok: true })
}
EOF
echo "✅ /api/track ready"

# ---------- 5) analytics client component ----------
cat > src/components/analytics.tsx << 'EOF'
'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function Analytics() {
  const pathname = usePathname()

  useEffect(() => {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname, referrer: document.referrer }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}
EOF

# ---------- 6) layout: mount analytics ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/layout.tsx'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('Analytics')) {
  s = s.replace("import Footer from '@/components/layout/footer'", "import Footer from '@/components/layout/footer'\nimport Analytics from '@/components/analytics'")
  s = s.replace('<RouteLoader />', '<RouteLoader />\n        <Analytics />')
  fs.writeFileSync(p, s)
  console.log('✅ layout: Analytics mounted')
} else console.log('⚠️ already')
NODEEOF

# ---------- 7) admin analytics panel ----------
mkdir -p src/app/admin/analytics
cat > src/app/admin/analytics/page.tsx << 'EOF'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'آمار | PromptsFA' }

export default async function AnalyticsPage() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  const now = new Date()
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now)
  const startToday = new Date(todayStr + 'T00:00:00+03:30')
  const startYesterday = new Date(startToday.getTime() - 86400000)
  const weekAgo = new Date(now.getTime() - 7 * 86400000)

  const [today, yesterday, total, week, topPaths, topRefs, latest] = await Promise.all([
    prisma.pageView.count({ where: { createdAt: { gte: startToday } } }),
    prisma.pageView.count({ where: { createdAt: { gte: startYesterday, lt: startToday } } }),
    prisma.pageView.count(),
    prisma.pageView.findMany({ where: { createdAt: { gte: weekAgo } }, select: { createdAt: true } }),
    prisma.pageView.groupBy({ by: ['path'], _count: { path: true }, orderBy: { _count: { path: 'desc' } }, take: 10 }),
    prisma.pageView.groupBy({ by: ['referrer'], _count: { referrer: true }, orderBy: { _count: { referrer: 'desc' } }, take: 8 }),
    prisma.pageView.findMany({ orderBy: { createdAt: 'desc' }, take: 15 }),
  ])

  // per-day buckets
  const days: { label: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    const label = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(d)
    days.push({ label, count: 0 })
  }
  for (const v of week) {
    const label = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(v.createdAt)
    const b = days.find((x) => x.label === label)
    if (b) b.count++
  }
  const max = Math.max(1, ...days.map((d) => d.count))

  return (
    <section className="container-app py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">📊 آمار بازدید</h1>
        <Link href="/admin" className="btn-secondary text-xs">← داشبورد</Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4 text-center"><p className="text-xs text-ink-muted">امروز</p><p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{today}</p></div>
        <div className="card p-4 text-center"><p className="text-xs text-ink-muted">دیروز</p><p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{yesterday}</p></div>
        <div className="card p-4 text-center"><p className="text-xs text-ink-muted">۷ روز</p><p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{week.length}</p></div>
        <div className="card p-4 text-center"><p className="text-xs text-ink-muted">کل</p><p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{total}</p></div>
      </div>

      <div className="card mt-6 p-5">
        <p className="text-sm font-bold text-gold-bright">نمودار ۷ روز اخیر</p>
        <div className="mt-4 flex h-40 items-end gap-2">
          {days.map((d) => (
            <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-ink-muted">{d.count}</span>
              <div className="w-full rounded-t bg-gold/60" style={{ height: Math.max(4, (d.count / max) * 130) + 'px' }} />
              <span className="text-[9px] text-ink-faint">{d.label.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <p className="border-b border-line p-4 text-sm font-bold text-gold-bright">پربازدیدترین صفحه‌ها</p>
          <div className="divide-y divide-line">
            {topPaths.map((t) => (
              <div key={t.path} className="flex items-center justify-between p-3">
                <span className="truncate text-xs text-ink" dir="ltr">{t.path}</span>
                <span className="shrink-0 text-xs font-bold text-gold-bright">{t._count.path}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          <p className="border-b border-line p-4 text-sm font-bold text-gold-bright">منابع ورودی (Referrer)</p>
          <div className="divide-y divide-line">
            {topRefs.filter((t) => t.referrer).map((t) => (
              <div key={t.referrer!} className="flex items-center justify-between p-3">
                <span className="truncate text-xs text-ink" dir="ltr">{t.referrer}</span>
                <span className="shrink-0 text-xs font-bold text-gold-bright">{t._count.referrer}</span>
              </div>
            ))}
            {topRefs.filter((t) => t.referrer).length === 0 && <p className="p-4 text-xs text-ink-faint">هنوز داده‌ای نیست.</p>}
          </div>
        </div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <p className="border-b border-line p-4 text-sm font-bold text-gold-bright">آخرین بازدیدها</p>
        <div className="divide-y divide-line">
          {latest.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-3 p-3">
              <span className="min-w-0 truncate text-xs text-ink" dir="ltr">{v.path}</span>
              <span className="shrink-0 text-[10px] text-ink-faint">{new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }).format(v.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
EOF
echo "✅ /admin/analytics panel created"

echo "✅ update115 done!"