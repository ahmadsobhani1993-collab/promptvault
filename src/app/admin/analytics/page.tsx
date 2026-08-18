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
