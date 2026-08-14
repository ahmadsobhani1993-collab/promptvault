import { requireAdmin } from '@/lib/admin'
import ArticleForm from '@/components/admin/article-form'

export const dynamic = 'force-dynamic'

export default async function NewArticle() {
  await requireAdmin()
  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">مقاله جدید</h1>
      <div className="mt-6">
        <ArticleForm locale="fa" />
      </div>
    </div>
  )
}
