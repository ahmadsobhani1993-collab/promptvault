#!/bin/bash
set -e

# ---------- 1) Ultra-simple analytics page ----------
cat > src/app/admin/analytics/page.tsx << 'EOF'
import Link from 'next/link'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  // Check auth
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') {
    redirect('/')
  }

  // Simple counts
  let stats = { total: 0, today: 0, yesterday: 0, week: 0 }
  
  try {
    const now = new Date()
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now)
    const startToday = new Date(todayStr + 'T00:00:00+03:30')
    const startYesterday = new Date(startToday.getTime() - 86400000)
    const weekAgo = new Date(now.getTime() - 7 * 86400000)

    const [total, today, yesterday, week] = await Promise.all([
      prisma.pageView.count(),
      prisma.pageView.count({ where: { createdAt: { gte: startToday } } }),
      prisma.pageView.count({ where: { createdAt: { gte: startYesterday, lt: startToday } } }),
      prisma.pageView.count({ where: { createdAt: { gte: weekAgo } } }),
    ])

    stats = { total, today, yesterday, week }
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
          <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{stats.today}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-ink-muted">دیروز</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{stats.yesterday}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-ink-muted">۷ روز</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{stats.week}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-ink-muted">کل</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{stats.total}</p>
        </div>
      </div>

      {stats.total === 0 && (
        <div className="card mt-6 p-6 text-center">
          <p className="text-sm text-ink-muted">هنوز هیچ بازدیدی ثبت نشده است.</p>
          <p className="mt-2 text-xs text-ink-faint">بعد از چند بازدید، آمار اینجا نمایش داده می‌شود.</p>
        </div>
      )}
    </section>
  )
}
EOF
echo "✅ Ultra-simple analytics page"

# ---------- 2) Remove Analytics component from layout temporarily ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/layout.tsx'
let s = fs.readFileSync(p, 'utf8')

// Comment out Analytics
s = s.replace(
  "import Analytics from '@/components/analytics'",
  "// import Analytics from '@/components/analytics' // DISABLED FOR DEBUG"
)
s = s.replace(
  '<Analytics />',
  '{/* <Analytics /> */} // DISABLED'
)

fs.writeFileSync(p, s)
console.log('✅ Analytics component disabled in layout')
NODEEOF

echo "✅ update172 done!"