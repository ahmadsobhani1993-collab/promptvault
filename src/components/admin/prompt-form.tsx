import { createPrompt, updatePrompt } from '@/app/admin/actions'

type Cat = { id: string; nameFa: string; nameEn: string; subs: { id: string; fa: string; en: string; slug: string }[] }

export default function PromptForm({
  categories,
  initial,
  locale,
}: {
  categories: Cat[]
  initial?: any
  locale: 'fa' | 'en'
}) {
  const action = initial ? updatePrompt.bind(null, initial.id) : createPrompt

  return (
    <form action={action} className="grid max-w-2xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="titleFa" defaultValue={initial?.titleFa ?? ''} placeholder="عنوان فارسی" className="input" required />
        <input name="titleEn" defaultValue={initial?.titleEn ?? ''} placeholder="Title (English)" className="input" required />
      </div>
      <input name="slug" defaultValue={initial?.slug ?? ''} placeholder="slug (اختیاری - خودکار)" className="input" />
      <input name="img" defaultValue={initial?.img ?? ''} placeholder="آدرس تصویر (https://...)" className="input" required />
      <div className="grid gap-4 sm:grid-cols-3">
        <input name="model" defaultValue={initial?.model ?? ''} placeholder="مدل (Midjourney...)" className="input" required />
        <select name="type" defaultValue={initial?.type ?? 'IMAGE'} className="input">
          <option value="IMAGE">تصویر</option>
          <option value="VIDEO">ویدیو</option>
          <option value="TEXT">متن</option>
          <option value="CODE">کد</option>
          <option value="AUDIO">موسیقی</option>
        </select>
        <select name="categoryId" defaultValue={initial?.categoryId ?? categories[0]?.id} className="input" required>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nameFa}</option>
          ))}
        </select>
      </div>
      <select name="subId" defaultValue={initial?.subId ?? ''} className="input">
        <option value="">بدون زیردسته</option>
        {categories.flatMap((c) => c.subs).map((s) => (
          <option key={s.id} value={s.id}>{s.fa}</option>
        ))}
      </select>
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="tagsFa" defaultValue={(initial?.tagsFa ?? []).join('، ')} placeholder="تگ‌های فارسی (با ، جدا کن)" className="input" />
        <input name="tagsEn" defaultValue={(initial?.tagsEn ?? []).join(', ')} placeholder="tags (comma separated)" className="input" />
      </div>
      <textarea name="prompt" defaultValue={initial?.prompt ?? ''} placeholder="متن کامل پرامپت..." rows={6} className="input resize-none font-mono" required dir="ltr" />
      <button type="submit" className="btn-primary w-fit">
        {locale === 'fa' ? 'ذخیره' : 'Save'}
      </button>
    </form>
  )
}
