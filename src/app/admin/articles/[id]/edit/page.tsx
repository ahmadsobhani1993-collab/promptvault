import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import ArticleForm from '@/components/article-form'

export const dynamic = 'force-dynamic'

export default async function EditArticle({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  const { id } = await params
  const article = await prisma.article.findUnique({ where: { id } })
  if (!article) notFound()

  return (
    <section className="container-app py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold">✍️ ویرایش مقاله</h1>
          <p className="mt-1 text-xs text-ink-muted">عنوان: {article.titleFa}</p>
        </div>
        <Link href="/admin/articles" className="btn-secondary text-xs">← لیست مقالات</Link>
      </div>
      <div className="max-w-3xl">
        <ArticleForm initialData={article} />
      </div>
    </section>
  )
}
