import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import { deletePrompt } from '@/app/admin/actions'

export const dynamic = 'force-dynamic'

export default async function AdminPrompts() {
  await requireAdmin()
  const prompts = await prisma.prompt.findMany({ orderBy: { createdAt: 'desc' }, include: { category: true } })

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
              <th className="p-4">دسته</th>
              <th className="p-4">مدل</th>
              <th className="p-4">لایک</th>
              <th className="p-4">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {prompts.map((p) => (
              <tr key={p.id} className="border-b border-line/50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <img src={p.img} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    <span className="line-clamp-1">{p.titleFa}</span>
                  </div>
                </td>
                <td className="p-4 text-ink-muted">{p.category.nameFa}</td>
                <td className="p-4 text-ink-muted">{p.model}</td>
                <td className="p-4 text-ink-muted">{p.likes}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Link href={'/admin/prompts/' + p.id + '/edit'} className="btn-secondary px-3 py-1 text-xs">ویرایش</Link>
                    <form action={deletePrompt.bind(null, p.id)}>
                      <button type="submit" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-1 text-xs text-danger">حذف</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
