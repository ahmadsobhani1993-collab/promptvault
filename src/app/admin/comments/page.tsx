import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import { deleteComment } from '@/app/admin/actions'

export const dynamic = 'force-dynamic'

export default async function AdminComments() {
  await requireAdmin()
  const comments = await prisma.comment.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: true, prompt: true, article: true },
  })

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">کامنت‌ها</h1>

      <div className="mt-6 space-y-4">
        {comments.length === 0 && (
          <p className="card p-6 text-sm text-ink-muted">هنوز کامنتی ثبت نشده.</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gold-bright">{c.user?.name ?? c.name}</p>
              <form action={deleteComment.bind(null, c.id)}>
                <button type="submit" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-1 text-xs text-danger">حذف</button>
              </form>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-muted">{c.text}</p>
            <p className="mt-2 text-[10px] text-ink-faint">
              روی: {c.prompt?.titleFa ?? c.article?.titleFa ?? '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
