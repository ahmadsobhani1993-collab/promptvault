import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import { promoteUser, demoteUser } from '@/app/admin/user-actions'

export const dynamic = 'force-dynamic'

export default async function AdminUsers() {
  const session = await requireAdmin()
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">کاربرها و ادمین‌ها</h1>
      <p className="mt-2 text-xs text-ink-muted">
        با دکمه‌ها نقش کاربر را عوض کن. (خودت را نمی‌توانی از ادمینی حذف کنی.)
      </p>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-right text-xs text-ink-muted">
              <th className="p-4">کاربر</th>
              <th className="p-4">نقش</th>
              <th className="p-4">تاریخ عضویت</th>
              <th className="p-4">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line/50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {u.image ? (
                      <img src={u.image} alt="" className="h-9 w-9 rounded-full" />
                    ) : (
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-gold/20 text-xs text-gold-bright">؟</span>
                    )}
                    <div>
                      <p className="line-clamp-1 font-bold">{u.name ?? '—'}</p>
                      <p className="text-[10px] text-ink-faint">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={'rounded-full border px-2 py-0.5 text-[10px] ' + (u.role === 'ADMIN' ? 'border-gold/40 bg-gold/10 text-gold-bright' : 'border-line bg-elevated text-ink-muted')}>
                    {u.role === 'ADMIN' ? 'ادمین' : 'کاربر'}
                  </span>
                </td>
                <td className="p-4 text-xs text-ink-muted">
                  {new Date(u.createdAt).toLocaleDateString('fa-IR')}
                </td>
                <td className="p-4">
                  {u.id !== session.user.id && (
                    <form action={u.role === 'ADMIN' ? demoteUser.bind(null, u.id) : promoteUser.bind(null, u.id)}>
                      <button type="submit" className="btn-secondary px-3 py-1 text-xs">
                        {u.role === 'ADMIN' ? 'حذف ادمین' : 'کردن به ادمین'}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
