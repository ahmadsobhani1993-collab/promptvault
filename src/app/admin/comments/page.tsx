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
    include: { user: true, prompt: true, article: true },
  })

  return (
    <section className="container-app py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">💬 کامنت‌ها ({rows.length})</h1>
        <Link href="/admin" className="btn-secondary text-xs">← داشبورد</Link>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="divide-y divide-line">
          {rows.map((c: any) => {
            const targetUrl = c.prompt?.slug
              ? `/prompts/${c.prompt.slug}#comments`
              : c.article?.slug
              ? `/blog/${c.article.slug}#comments`
              : null

            const targetTitle = c.prompt?.titleFa ?? c.article?.titleFa ?? '—'

            return (
              <div key={c.id} className="flex items-start justify-between gap-4 p-4 hover:bg-surface/40 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-6 text-ink font-medium">{c.text}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                    <span className="font-bold text-ink">{c.user?.name ?? c.name ?? 'کاربر'}</span>
                    <span>·</span>
                    <span>روی:</span>
                    {targetUrl ? (
                      <Link
                        href={targetUrl}
                        target="_blank"
                        className="inline-flex items-center gap-1 font-bold text-gold-bright hover:underline"
                      >
                        <span>{targetTitle}</span>
                        <span className="text-[10px]">↗</span>
                      </Link>
                    ) : (
                      <span>{targetTitle}</span>
                    )}
                    <span>·</span>
                    <span className="text-ink-faint">
                      {new Intl.DateTimeFormat('fa-IR', {
                        timeZone: 'Asia/Tehran',
                        dateStyle: 'medium',
                      }).format(c.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {targetUrl && (
                    <Link
                      href={targetUrl}
                      target="_blank"
                      className="rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-bold text-gold-bright hover:bg-gold/20 transition-all"
                    >
                      💬 مشاهده و پاسخ
                    </Link>
                  )}
                  <CommentActions id={c.id} />
                </div>
              </div>
            )
          })}
          {rows.length === 0 && <p className="p-6 text-center text-xs text-ink-faint">کامنتی نیست.</p>}
        </div>
      </div>
    </section>
  )
}