import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import ArticleActions from '@/components/article-actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'مقالات | مدیریت' }

export default async function AdminArticles() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  const rows = await prisma.article.findMany({ orderBy: { createdAt: 'desc' }, take: 60 })

  return (
    <section className="container-app py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">📚 مقالات ({rows.length})</h1>
        <div className="flex gap-2"><Link href="/admin/articles/new" className="btn-primary text-xs">+ مقاله دستی</Link><Link href="/admin" className="btn-secondary text-xs">← داشبورد</Link></div>
      </div>
      <p className="mt-2 text-xs text-ink-muted">مقالات هوش مصنوعی ابتدا «در انتظار» می‌مانند؛ پس از بازبینی، انتشار بزن.</p>

      <div className="card mt-6 overflow-hidden">
        <div className="divide-y divide-line">
          {rows.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link href={'/blog/' + a.slug} className="block truncate text-xs font-bold text-ink transition-colors hover:text-gold-bright">{a.titleFa}</Link>
                <p className="mt-1 text-[10px] text-ink-faint">
                  {new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium' }).format(a.createdAt)}
                  {' · '}{a.tagFa}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={'rounded-full px-2 py-0.5 text-[9px] ' + (a.status === 'PUBLISHED' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400')}>
                  {a.status === 'PUBLISHED' ? 'منتشر' : 'در انتظار'}
                </span>
                <Link href={'/admin/articles/' + a.id + '/edit'} className="rounded-full bg-blue-500/15 px-3 py-1 text-[10px] text-blue-400 transition-colors hover:bg-blue-500/25">✏️ ویرایش</Link>
                <ArticleActions id={a.id} status={a.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
