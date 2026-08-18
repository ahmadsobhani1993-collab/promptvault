import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import CommentActions from '@/components/comment-actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'کامنت‌ها | مدیریت' }

export default async function AdminComments() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  const rows = await prisma.comment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 80,
    include: { user: true, prompt: true, article: true, },
  })

  return (
    <section className="container-app py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">💬 کامنت‌ها ({rows.length})</h1>
        <Link href="/admin" className="btn-secondary text-xs">← داشبورد</Link>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="divide-y divide-line">
          {rows.map((c: any) => (
            <div key={c.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-xs leading-6 text-ink">{c.text}</p>
                <p className="mt-1 text-[10px] text-ink-faint">
                  {c.user?.name ?? 'کاربر'} · روی: {c.prompt?.titleFa ?? c.article?.titleFa ?? '—'} · {new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium' }).format(c.createdAt)}
                </p>
              </div>
              <CommentActions id={c.id} />
            </div>
          ))}
          {rows.length === 0 && <p className="p-6 text-center text-xs text-ink-faint">کامنتی نیست.</p>}
        </div>
      </div>
    </section>
  )
}
