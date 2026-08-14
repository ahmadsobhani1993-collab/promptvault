import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import { deletePrompt } from '@/app/admin/actions'
import { approvePrompt, rejectPrompt } from '@/app/admin/review-actions'

export const dynamic = 'force-dynamic'

const statusLabel: Record<string, { fa: string; cls: string }> = {
  PUBLISHED: { fa: 'منتشرشده', cls: 'text-success border-success/40 bg-success/10' },
  PENDING: { fa: 'در انتظار بررسی', cls: 'text-warning border-warning/40 bg-warning/10' },
  REJECTED: { fa: 'ردشده', cls: 'text-danger border-danger/40 bg-danger/10' },
}

export default async function AdminPrompts() {
  await requireAdmin()
  const prompts = await prisma.prompt.findMany({
    orderBy: { createdAt: 'desc' },
    include: { category: true, user: true },
  })

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">پرامپت‌ها</h1>
        <Link href="/admin/prompts/new" className="btn-primary">+ پرامپت جدید</Link>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-right text-xs text-ink-muted">
              <th className="p-4">عنوان</th>
              <th className="p-4">ارسال‌کننده</th>
              <th className="p-4">وضعیت</th>
              <th className="p-4">لایک</th>
              <th className="p-4">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {prompts.map((p) => {
              const st = statusLabel[p.status] ?? statusLabel.PUBLISHED
              return (
                <tr key={p.id} className="border-b border-line/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img src={p.img} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      <span className="line-clamp-1">{p.titleFa}</span>
                    </div>
                  </td>
                  <td className="p-4 text-xs text-ink-muted">{p.user?.name ?? 'ادمین'}</td>
                  <td className="p-4">
                    <span className={'rounded-full border px-2 py-0.5 text-[10px] ' + st.cls}>{st.fa}</span>
                  </td>
                  <td className="p-4 text-ink-muted">{p.likes}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {p.status === 'PENDING' && (
                        <>
                          <form action={approvePrompt.bind(null, p.id)}>
                            <button type="submit" className="rounded-xl border border-success/40 bg-success/10 px-3 py-1 text-xs text-success">تأیید</button>
                          </form>
                          <form action={rejectPrompt.bind(null, p.id)}>
                            <button type="submit" className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-1 text-xs text-warning">رد</button>
                          </form>
                        </>
                      )}
                      {p.status === 'REJECTED' && (
                        <form action={approvePrompt.bind(null, p.id)}>
                          <button type="submit" className="rounded-xl border border-success/40 bg-success/10 px-3 py-1 text-xs text-success">انتشار</button>
                        </form>
                      )}
                      <Link href={'/admin/prompts/' + p.id + '/edit'} className="btn-secondary px-3 py-1 text-xs">ویرایش</Link>
                      <form action={deletePrompt.bind(null, p.id)}>
                        <button type="submit" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-1 text-xs text-danger">حذف</button>
                      </form>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
