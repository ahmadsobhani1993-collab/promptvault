import { createArticle } from '@/app/admin/actions'

export default function ArticleForm({ locale }: { locale: 'fa' | 'en' }) {
  return (
    <form action={createArticle} className="grid max-w-2xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="titleFa" placeholder="عنوان فارسی" className="input" required />
        <input name="titleEn" placeholder="Title (English)" className="input" required />
      </div>
      <input name="slug" placeholder="slug (اختیاری)" className="input" />
      <input name="img" placeholder="آدرس تصویر شاخص" className="input" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="descFa" placeholder="توضیح کوتاه فارسی" className="input" required />
        <input name="descEn" placeholder="Short description" className="input" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <input name="tagFa" placeholder="تگ فارسی" className="input" required />
        <input name="tagEn" placeholder="tag" className="input" required />
        <input name="dateFa" placeholder="تاریخ فا (۲۵ تیر ۱۴۰۵)" className="input" required />
        <input name="dateEn" placeholder="date (Jul 16, 2026)" className="input" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="readFa" placeholder="زمان مطالعه (۶ دقیقه)" className="input" required />
        <input name="readEn" placeholder="read time (6 min)" className="input" required />
      </div>
      <textarea name="contentFa" placeholder="متن فارسی مقاله (هر خط = یک پاراگراف)" rows={6} className="input resize-none" required />
      <textarea name="contentEn" placeholder="English content (each line = paragraph)" rows={6} className="input resize-none" required />
      <button type="submit" className="btn-primary w-fit">
        {locale === 'fa' ? 'انتشار مقاله' : 'Publish'}
      </button>
    </form>
  )
}
