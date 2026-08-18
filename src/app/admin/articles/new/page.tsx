import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import ArticleForm from '@/components/article-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'مقاله جدید | مدیریت' }

export default async function NewArticle() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  return (
    <section className="container-app py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">✍️ مقاله دستی جدید</h1>
        <Link href="/admin/articles" className="btn-secondary text-xs">← لیست مقالات</Link>
      </div>
      <div className="mt-6 max-w-3xl">
        <ArticleForm />
      </div>
    </section>
  )
}
