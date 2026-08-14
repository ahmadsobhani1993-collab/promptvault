import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import { deleteArticle } from '@/app/admin/actions'

export const dynamic = 'force-dynamic'

export default async function AdminArticles() {
  await requireAdmin()
  const articles = await prisma.article.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">مقالات</h1>
        <Link href="/admin/articles/new" className="btn-primary">+ مقاله جدید</Link>
      </div>

      <div className="mt-6 space-y-4">
        {articles.map((a) => (
          <div key={a.id} className="card flex items-center gap-4 p-4">
            <img src={a.img} alt="" className="h-14 w-14 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-bold">{a.titleFa}</p>
              <p className="mt-1 text-xs text-ink-faint">{a.tagFa} • {a.dateFa}</p>
            </div>
            <form action={deleteArticle.bind(null, a.id)}>
              <button type="submit" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-1 text-xs text-danger">حذف</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  )
}
