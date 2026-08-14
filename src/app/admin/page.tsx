import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  await requireAdmin()

  const [prompts, users, comments, likes] = await Promise.all([
    prisma.prompt.count(),
    prisma.user.count(),
    prisma.comment.count(),
    prisma.like.count(),
  ])

  const recentPrompts = await prisma.prompt.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })
  const recentUsers = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })

  const stats = [
    { label: 'پرامپت‌ها', value: prompts },
    { label: 'کاربرها', value: users },
    { label: 'کامنت‌ها', value: comments },
    { label: 'لایک‌ها', value: likes },
  ]

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">داشبورد</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-xs text-ink-muted">{s.label}</p>
            <p className="mt-2 font-display text-3xl font-extrabold text-gold-bright">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-bold text-gold-bright">آخرین پرامپت‌ها</h2>
          <ul className="mt-4 space-y-3">
            {recentPrompts.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="line-clamp-1">{p.titleFa}</span>
                <span className="text-xs text-ink-faint">{p.likes} لایک</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-bold text-gold-bright">آخرین کاربرها</h2>
          <ul className="mt-4 space-y-3">
            {recentUsers.map((u) => (
              <li key={u.id} className="flex items-center gap-3 text-sm">
                {u.image ? (
                  <img src={u.image} alt="" className="h-7 w-7 rounded-full" />
                ) : (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-gold/20 text-xs text-gold-bright">؟</span>
                )}
                <span className="line-clamp-1">{u.name ?? u.email}</span>
                <span className="ms-auto text-xs text-ink-faint">{u.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
