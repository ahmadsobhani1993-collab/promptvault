import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import PromptActions from '@/components/prompt-actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'پرامپت‌ها | مدیریت' }

const TABS = [
  { key: 'pending', fa: '🕓 در انتظار' },
  { key: 'published', fa: '✅ منتشرشده' },
  { key: 'rejected', fa: '⛔ ردشده' },
  { key: 'all', fa: 'همه' },
]

export default async function AdminPrompts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  const tab = params.tab ?? 'pending'
  const q = params.q ?? ''
  const where: any = {}
  if (tab !== 'all') where.status = tab.toUpperCase()
  if (q) where.titleFa = { contains: q, mode: 'insensitive' }

  const [rows, pendingCount] = await Promise.all([
    prisma.prompt.findMany({ where, orderBy: { createdAt: 'desc' }, take: 60, include: { category: true } }),
    prisma.prompt.count({ where: { status: 'PENDING' } }),
  ])

  const chip = (active: boolean) =>
    'rounded-full border px-4 py-1.5 text-xs transition-colors ' +
    (active ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted hover:border-gold/40')

  return (
    <section className="container-app py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">📦 پرامپت‌ها {pendingCount > 0 && <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-400">{pendingCount} در انتظار</span>}</h1>
        <Link href="/admin" className="btn-secondary text-xs">← داشبورد</Link>
      </div>

      <form className="mt-4 flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder="جستجوی عنوان..." className="input text-xs" />
        {tab !== 'all' && <input type="hidden" name="tab" value={tab} />}
        <button className="btn-secondary text-xs">جستجو</button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={'/admin/prompts?tab=' + t.key} className={chip(tab === t.key)}>{t.fa}</Link>
        ))}
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="divide-y divide-line">
          {rows.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link href={'/admin/prompts/' + p.id + '/preview'} className="block truncate text-xs font-bold text-ink transition-colors hover:text-gold-bright">{p.titleFa}</Link>
                <p className="mt-1 text-[10px] text-ink-faint">
                  {p.category?.nameFa ?? '—'} · ❤ {p.likes} · 👁 {p.views} · {new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium' }).format(p.createdAt)}
                </p>
              </div>
              <PromptActions id={p.id} status={p.status} />
            </div>
          ))}
          {rows.length === 0 && <p className="p-6 text-center text-xs text-ink-faint">موردی نیست.</p>}
        </div>
      </div>
    </section>
  )
}
