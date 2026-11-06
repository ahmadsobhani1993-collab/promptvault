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
  const newsRows = rows.filter((article) => article.tagFa === 'اخبار' || article.slug.startsWith('news-ai-daily-'))
  const articleRows = rows.filter((article) => !newsRows.includes(article))

  function renderRows(items: typeof rows) {
    if (items.length === 0) {
      return <p className="p-5 text-xs text-ink-muted">موردی برای نمایش وجود ندارد.</p>
    }

    return (
      <div className="divide-y divide-line">
        {items.map((article) => (
          <div key={article.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              {article.status === 'PUBLISHED' ? (
                <Link href={'/blog/' + article.slug} className="block truncate text-xs font-bold text-ink transition-colors hover:text-gold-bright">{article.titleFa}</Link>
              ) : (
                <span className="block truncate text-xs font-bold text-ink">{article.titleFa}</span>
              )}
              <p className="mt-1 text-[10px] text-ink-faint">
                {new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium' }).format(article.createdAt)}
                {' · '}{article.tagFa}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={'rounded-full px-2 py-0.5 text-[9px] ' + (article.status === 'PUBLISHED' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400')}>
                {article.status === 'PUBLISHED' ? 'منتشر' : 'در انتظار بررسی'}
              </span>
              <Link href={'/admin/articles/' + article.id + '/edit'} className="rounded-full bg-blue-500/15 px-3 py-1 text-[10px] text-blue-400 transition-colors hover:bg-blue-500/25">✏️ ویرایش</Link>
              <ArticleActions id={article.id} status={article.status} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <section className="container-app py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">📚 مدیریت محتوا ({rows.length})</h1>
        <div className="flex gap-2"><Link href="/admin/articles/new" className="btn-primary text-xs">+ مقاله دستی</Link><Link href="/admin" className="btn-secondary text-xs">← داشبورد</Link></div>
      </div>
      <p className="mt-2 text-xs text-ink-muted">مقالات و اخبار را جداگانه بررسی، ویرایش و منتشر کنید.</p>

      <nav className="mt-6 flex gap-3 text-xs">
        <a href="#articles" className="btn-secondary">مقالات ({articleRows.length})</a>
        <a href="#news" className="btn-secondary">اخبار ({newsRows.length})</a>
      </nav>

      <section id="articles" className="mt-8 scroll-mt-24">
        <h2 className="mb-3 font-display text-lg font-bold">مقالات و آموزش هوش مصنوعی ({articleRows.length})</h2>
        <div className="card overflow-hidden">{renderRows(articleRows)}</div>
      </section>

      <section id="news" className="mt-8 scroll-mt-24">
        <h2 className="mb-3 font-display text-lg font-bold">اخبار ({newsRows.length})</h2>
        <div className="card overflow-hidden">{renderRows(newsRows)}</div>
      </section>
    </section>
  )
}
