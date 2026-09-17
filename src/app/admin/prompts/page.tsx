import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import PromptActions from '@/components/prompt-actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'پرامپت‌ها | مدیریت' }

const TABS = [
  { key: 'pending', fa: '🕒 در انتظار' },
  { key: 'published', fa: '✅ منتشرشده' },
  { key: 'rejected', fa: '⛔ ردشده' },
  { key: 'all', fa: 'همه' },
]

export default async function AdminPrompts({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  const tab = params.tab ?? 'pending'
  const q = params.q ?? ''
  const sort = params.sort ?? 'newest'

  const where: any = {}
  if (tab !== 'all') where.status = tab.toUpperCase()
  if (q) where.titleFa = { contains: q, mode: 'insensitive' }

  const orderBy = sort === 'views' ? { views: 'desc' as const } : { createdAt: 'desc' as const }

  const [rows, pendingCount] = await Promise.all([
    prisma.prompt.findMany({
      where,
      orderBy,
      take: 80,
      include: { category: true },
    }),
    prisma.prompt.count({ where: { status: 'PENDING' } }),
  ])

  const chip = (active: boolean) =>
    'rounded-full border px-4 py-1.5 text-xs transition-colors ' +
    (active ? 'border-gold bg-gold/15 text-gold font-bold' : 'border-line bg-surface/50 text-ink-muted hover:border-gold/40')

  return (
    <section className="py-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-black text-ink flex items-center gap-2">
            <span>📦 مدیریت پرامپت‌ها</span>
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                {pendingCount} در انتظار بررسی
              </span>
            )}
          </h1>
          <p className="mt-1 text-xs text-ink-muted">تأیید، ویرایش، حذف و بررسی آمار تعامل کاربران</p>
        </div>
        <Link href="/admin/prompts/new" className="rounded-xl bg-gold px-4 py-2 text-xs font-bold text-base hover:bg-gold-bright transition-colors">
          + افزودن پرامپت جدید
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <form className="flex w-full max-w-md gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="جستجوی عنوان پرامپت..."
            className="w-full rounded-xl border border-line bg-surface/80 px-3.5 py-2 text-xs text-ink outline-none focus:border-gold"
          />
          {tab !== 'all' && <input type="hidden" name="tab" value={tab} />}
          {sort !== 'newest' && <input type="hidden" name="sort" value={sort} />}
          <button type="submit" className="shrink-0 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-medium text-ink hover:border-gold">
            جستجو
          </button>
        </form>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-ink-muted">مرتب‌سازی:</span>
          <Link
            href={`/admin/prompts?tab=${tab}&sort=newest${q ? `&q=${q}` : ''}`}
            className={`rounded-lg px-2.5 py-1 transition-colors ${sort === 'newest' ? 'bg-gold/15 text-gold font-bold' : 'text-ink-muted hover:text-ink'}`}
          >
            جدیدترین
          </Link>
          <span className="text-line">|</span>
          <Link
            href={`/admin/prompts?tab=${tab}&sort=views${q ? `&q=${q}` : ''}`}
            className={`rounded-lg px-2.5 py-1 transition-colors ${sort === 'views' ? 'bg-gold/15 text-gold font-bold' : 'text-ink-muted hover:text-ink'}`}
          >
            پربازدیدترین
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/prompts?tab=${t.key}${sort !== 'newest' ? `&sort=${sort}` : ''}${q ? `&q=${q}` : ''}`}
            className={chip(tab === t.key)}
          >
            {t.fa}
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface/50 overflow-hidden">
        <div className="divide-y divide-line/60">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">پرامپتی با این شرایط یافت نشد.</div>
          ) : (
            rows.map((p) => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-surface/80 transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${p.status === 'PUBLISHED' ? 'bg-emerald-400' : p.status === 'PENDING' ? 'bg-amber-400' : 'bg-red-400'}`} />
                    <Link href={`/admin/prompts/${p.id}/preview`} className="truncate text-xs font-bold text-ink hover:text-gold transition-colors">
                      {p.titleFa}
                    </Link>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    دسته‌بندی: {p.category?.nameFa ?? '—'} · مدل: {p.model || 'عمومی'} · بازدید: {p.views} · تاریخ: {new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium' }).format(p.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <Link
                    href={`/admin/prompts/${p.slug}/edit`}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted hover:border-gold hover:text-gold transition-colors"
                  >
                    ویرایش
                  </Link>
                  <PromptActions promptId={p.id} currentStatus={p.status} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
