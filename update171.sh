#!/bin/bash
set -e

echo "----- Checking current state -----"
echo "Analytics page exists:"
ls -la src/app/admin/analytics/page.tsx 2>/dev/null || echo "NOT FOUND"

echo ""
echo "Layout.tsx Analytics status:"
grep -n "Analytics" src/app/layout.tsx || echo "Not found"

echo ""
echo "PageView model in schema:"
grep -A 5 "model PageView" prisma/schema.prisma || echo "NOT FOUND"

echo "----------------------------------"

# ---------- 1) Fix analytics page: remove complex queries ----------
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

  let today = 0
  let yesterday = 0
  let total = 0
  let weekCount = 0

  try {
    const now = new Date()
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now)
    const startToday = new Date(todayStr + 'T00:00:00+03:30')
    const startYesterday = new Date(startToday.getTime() - 86400000)
    const weekAgo = new Date(now.getTime() - 7 * 86400000)

    total = await prisma.pageView.count()
    today = await prisma.pageView.count({ where: { createdAt: { gte: startToday } } })
    yesterday = await prisma.pageView.count({ where: { createdAt: { gte: startYesterday, lt: startToday } } })
    weekCount = await prisma.pageView.count({ where: { createdAt: { gte: weekAgo } } })
  } catch (err) {
    console.error('Analytics error:', err)
  }

  return (
    <section className="container-app py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">📊 آمار بازدید</h1>
        <Link href="/admin" className="btn-secondary text-xs">← داشبورد</Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4 text-center">
          <p className="text-xs text-ink-muted">امروز</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{today}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-ink-muted">دیروز</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{yesterday}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-ink-muted">۷ روز</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{weekCount}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-ink-muted">کل</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{total}</p>
        </div>
      </div>

      {total === 0 && (
        <div className="card mt-6 p-6 text-center">
          <p className="text-sm text-ink-muted">هنوز هیچ بازدیدی ثبت نشده است.</p>
          <p className="mt-2 text-xs text-ink-faint">بعد از چند بازدید، آمار اینجا نمایش داده می‌شود.</p>
        </div>
      )}
    </section>
  )
}
EOF
echo "✅ Analytics page: simplified"

# ---------- 2) Ensure PageView model exists ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'prisma/schema.prisma'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('model PageView')) {
  s += '\nmodel PageView {\n  id        String   @id @default(cuid())\n  path      String\n  referrer  String?\n  ua        String?\n  ip        String?\n  createdAt DateTime @default(now())\n}\n'
  fs.writeFileSync(p, s)
  console.log('✅ PageView model added to schema')
} else {
  console.log('⚠️ PageView already exists')
}
NODEEOF

# ---------- 3) Push schema to database ----------
echo "Pushing schema to database..."
npx prisma db push --accept-data-loss

# ---------- 4) Re-enable Analytics in layout ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/layout.tsx'
let s = fs.readFileSync(p, 'utf8')

// Re-enable Analytics
s = s.replace(
  "// import Analytics from '@/components/analytics' // TEMP DISABLED",
  "import Analytics from '@/components/analytics'"
)
s = s.replace(
  '{/* <Analytics /> */}',
  '<Analytics />'
)

fs.writeFileSync(p, s)
console.log('✅ Analytics re-enabled in layout')
NODEEOF

echo "✅ update171 done!"