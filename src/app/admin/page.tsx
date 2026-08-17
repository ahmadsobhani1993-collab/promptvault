import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'مدیریت | PromptsFA' }

export default async function AdminPage() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  const [prompts, users, likes, comments, pending] = await Promise.all([
    prisma.prompt.count(),
    prisma.user.count(),
    prisma.like.count(),
    prisma.comment.count(),
    prisma.prompt.count({ where: { status: 'PENDING' } }),
  ])

  const latest = await prisma.prompt.findMany({
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: { id: true, titleFa: true, likes: true, status: true, slug: true },
  })

  const nav = [
    { href: '/admin', label: ' داشبورد' },
    { href: '/admin/prompts', label: '📦 پرامپت‌ها' + (pending ? ' (' + pending + ')' : '') },
    { href: '/admin/articles', label: '📚 مقالات' },
    { href: '/admin/categories', label: '🗂 دسته‌بندی‌ها' },
    { href: '/admin/comments', label: '💬 کامنت‌ها' },
    { href: '/admin/users', label: '👥 کاربرها و ادمین‌ها' },
  ]

  const stats = [
    { label: 'پرامپت‌ها', value: prompts },
    { label: 'کاربرها', value: users },
    { label: 'لایک‌ها', value: likes },
    { label: 'کامنت‌ها', value: comments },
  ]

  return (
    <section className="container-app py-10">
      <div className="grid items-start gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-col">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="btn-secondary justify-center whitespace-nowrap text-xs">
              {n.label}
            </Link>
          ))}
          <Link href="/" className="btn-secondary justify-center whitespace-nowrap text-xs">← بازگشت به سایت</Link>
        </aside>

        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="card p-4 text-center">
                <p className="text-xs text-ink-muted">{s.label}</p>
                <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="card mt-5 overflow-hidden">
            <p className="border-b border-line p-4 text-sm font-bold text-gold-bright">آخرین پرامپت‌ها</p>
            <div className="divide-y divide-line">
              {latest.map((p) => (
                <Link key={p.id} href={'/prompts/' + p.slug} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-elevated">
                  <span className="min-w-0 truncate text-xs text-ink">{p.titleFa}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={'rounded-full px-2 py-0.5 text-[9px] ' + (p.status === 'PUBLISHED' ? 'bg-green-500/15 text-green-400' : p.status === 'PENDING' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400')}>
                      {p.status === 'PUBLISHED' ? 'منتشر' : p.status === 'PENDING' ? 'در انتظار' : 'رد'}
                    </span>
                    <span className="text-[10px] text-ink-faint">❤ {p.likes}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
