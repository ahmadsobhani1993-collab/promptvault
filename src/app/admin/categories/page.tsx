import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'
import { createCategory, deleteCategory } from '@/app/admin/actions'

export const dynamic = 'force-dynamic'

export default async function AdminCategories() {
  await requireAdmin()
  const categories = await prisma.category.findMany({ include: { subs: true, _count: { select: { prompts: true } } }, orderBy: { order: 'asc' } })

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">دسته‌بندی‌ها</h1>

      <form action={createCategory} className="card mt-6 grid max-w-2xl gap-4 p-6">
        <p className="text-sm font-bold text-gold-bright">دسته جدید</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="nameFa" placeholder="نام فارسی" className="input" required />
          <input name="nameEn" placeholder="Name (English)" className="input" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <select name="icon" className="input">
            <option value="camera">دوربین (تصویر)</option>
            <option value="play">پخش (ویدیو)</option>
            <option value="file">فایل (متن)</option>
            <option value="code">کد</option>
            <option value="music">موسیقی</option>
            <option value="gear">چرخ‌دنده (بهره‌وری)</option>
          </select>
          <input name="slug" placeholder="slug (اختیاری)" className="input" />
        </div>
        <input name="descFa" placeholder="توضیح فارسی" className="input" required />
        <input name="descEn" placeholder="Description" className="input" required />
        <textarea name="subs" placeholder={'زیردسته‌ها (هر خط: slug|فا|en)\nمثال: photography|عکاسی|Photography'} rows={4} className="input resize-none" />
        <button type="submit" className="btn-primary w-fit">افزودن دسته</button>
      </form>

      <div className="mt-8 space-y-4">
        {categories.map((c) => (
          <div key={c.id} className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{c.nameFa} <span className="text-xs text-ink-faint">({c._count.prompts} پرامپت)</span></p>
              <form action={deleteCategory.bind(null, c.id)}>
                <button type="submit" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-1 text-xs text-danger">حذف</button>
              </form>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {c.subs.map((s) => (
                <span key={s.id} className="badge">{s.fa}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
