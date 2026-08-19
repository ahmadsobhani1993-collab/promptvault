#!/bin/bash
set -e

# ---------- 1) Enhanced analytics with unique visitors + "View More" ----------
cat > src/app/admin/analytics/page.tsx << 'EOF'
import Link from 'next/link'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'آمار بازدید | PromptsFA' }

export default async function AnalyticsPage() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  let stats = { total: 0, today: 0, yesterday: 0, week: 0, unique: 0 }
  let days: { label: string; count: number }[] = []
  let topPaths: { path: string; count: number }[] = []
  let topRefs: { referrer: string; count: number }[] = []
  let latest: any[] = []

  try {
    const now = new Date()
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now)
    const startToday = new Date(todayStr + 'T00:00:00+03:30')
    const startYesterday = new Date(startToday.getTime() - 86400000)
    const weekAgo = new Date(now.getTime() - 7 * 86400000)

    const [total, today, yesterday, week, uniqueIPs] = await Promise.all([
      prisma.pageView.count(),
      prisma.pageView.count({ where: { createdAt: { gte: startToday } } }),
      prisma.pageView.count({ where: { createdAt: { gte: startYesterday, lt: startToday } } }),
      prisma.pageView.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.pageView.groupBy({ by: ['ip'], _count: true }),
    ])
    stats = { total, today, yesterday, week, unique: uniqueIPs.length }

    // Per-day buckets for 7 days
    days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000)
      const label = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(d)
      days.push({ label, count: 0 })
    }
    const weekViews = await prisma.pageView.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: { createdAt: true },
    })
    for (const v of weekViews) {
      const label = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(v.createdAt)
      const b = days.find((x) => x.label === label)
      if (b) b.count++
    }

    // Top paths (get all for "view more")
    const pathsRaw = await prisma.$queryRaw`
      SELECT path, COUNT(*)::int as count
      FROM "PageView"
      GROUP BY path
      ORDER BY count DESC
    ` as any[]
    topPaths = pathsRaw.map((r: any) => ({ path: r.path, count: r.count }))

    // Top referrers
    const refsRaw = await prisma.$queryRaw`
      SELECT referrer, COUNT(*)::int as count
      FROM "PageView"
      WHERE referrer IS NOT NULL AND referrer != ''
      GROUP BY referrer
      ORDER BY count DESC
    ` as any[]
    topRefs = refsRaw.map((r: any) => ({ referrer: r.referrer, count: r.count }))

    // Latest visits
    latest = await prisma.pageView.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
  } catch (err) {
    console.error('Analytics error:', err)
  }

  const max = Math.max(1, ...days.map((d) => d.count))

  return (
    <section className="container-app py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">📊 آمار بازدید</h1>
        <Link href="/admin" className="btn-secondary text-xs">← داشبورد</Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
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
        <div className="card p-4 text-center">
          <p className="text-xs text-ink-muted">کاربران متفاوت</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{stats.unique}</p>
        </div>
      </div>

      {/* 7-day chart */}
      <div className="card mt-6 p-5">
        <p className="text-sm font-bold text-gold-bright">نمودار ۷ روز اخیر</p>
        <div className="mt-4 flex h-40 items-end gap-2">
          {days.map((d) => (
            <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-ink-muted">{d.count}</span>
              <div
                className="w-full rounded-t bg-gold/60"
                style={{ height: Math.max(4, (d.count / max) * 130) + 'px' }}
              />
              <span className="text-[9px] text-ink-faint">{d.label.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Top paths */}
        <div className="card overflow-hidden">
          <p className="border-b border-line p-4 text-sm font-bold text-gold-bright">پربازدیدترین صفحه‌ها</p>
          <div className="divide-y divide-line">
            {topPaths.slice(0, 4).map((t) => (
              <div key={t.path} className="flex items-center justify-between p-3">
                <span className="truncate text-xs text-ink" dir="ltr">{t.path}</span>
                <span className="shrink-0 text-xs font-bold text-gold-bright">{t.count}</span>
              </div>
            ))}
            {topPaths.length === 0 && <p className="p-4 text-xs text-ink-faint">هنوز داده‌ای نیست.</p>}
          </div>
          {topPaths.length > 4 && (
            <div className="border-t border-line p-3 text-center">
              <details className="text-xs text-gold-bright">
                <summary className="cursor-pointer">مشاهده همه ({topPaths.length})</summary>
                <div className="mt-2 divide-y divide-line rounded-lg bg-[#0a0805]">
                  {topPaths.slice(4).map((t) => (
                    <div key={t.path} className="flex items-center justify-between p-2">
                      <span className="truncate text-[10px] text-ink" dir="ltr">{t.path}</span>
                      <span className="shrink-0 text-[10px] text-ink-faint">{t.count}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>

        {/* Top referrers */}
        <div className="card overflow-hidden">
          <p className="border-b border-line p-4 text-sm font-bold text-gold-bright">منابع ورودی</p>
          <div className="divide-y divide-line">
            {topRefs.slice(0, 4).map((t) => (
              <div key={t.referrer} className="flex items-center justify-between p-3">
                <span className="truncate text-xs text-ink" dir="ltr">{t.referrer}</span>
                <span className="shrink-0 text-xs font-bold text-gold-bright">{t.count}</span>
              </div>
            ))}
            {topRefs.length === 0 && <p className="p-4 text-xs text-ink-faint">هنوز داده‌ای نیست.</p>}
          </div>
          {topRefs.length > 4 && (
            <div className="border-t border-line p-3 text-center">
              <details className="text-xs text-gold-bright">
                <summary className="cursor-pointer">مشاهده همه ({topRefs.length})</summary>
                <div className="mt-2 divide-y divide-line rounded-lg bg-[#0a0805]">
                  {topRefs.slice(4).map((t) => (
                    <div key={t.referrer} className="flex items-center justify-between p-2">
                      <span className="truncate text-[10px] text-ink" dir="ltr">{t.referrer}</span>
                      <span className="shrink-0 text-[10px] text-ink-faint">{t.count}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      </div>

      {/* Latest visits */}
      <div className="card mt-6 overflow-hidden">
        <p className="border-b border-line p-4 text-sm font-bold text-gold-bright">آخرین بازدیدها</p>
        <div className="divide-y divide-line">
          {latest.slice(0, 4).map((v: any) => (
            <div key={v.id} className="flex items-center justify-between gap-3 p-3">
              <span className="min-w-0 truncate text-xs text-ink" dir="ltr">{v.path}</span>
              <span className="shrink-0 text-[10px] text-ink-faint">
                {new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }).format(v.createdAt)}
              </span>
            </div>
          ))}
          {latest.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">هنوز بازدیدی ثبت نشده.</p>}
        </div>
        {latest.length > 4 && (
          <div className="border-t border-line p-3 text-center">
            <details className="text-xs text-gold-bright">
              <summary className="cursor-pointer">مشاهده همه ({latest.length})</summary>
              <div className="mt-2 divide-y divide-line rounded-lg bg-[#0a0805]">
                {latest.slice(4).map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 p-2">
                    <span className="min-w-0 truncate text-[10px] text-ink" dir="ltr">{v.path}</span>
                    <span className="shrink-0 text-[10px] text-ink-faint">
                      {new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }).format(v.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </section>
  )
}
EOF
echo "✅ Analytics: unique visitors + view more for all sections"

echo "✅ update178 done!"