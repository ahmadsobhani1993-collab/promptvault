import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { type Locale } from '@/lib/i18n'
import { L } from '@/lib/data'
import { TAG_VOCAB } from '@/lib/gemini'
import TagPicker from '@/components/tag-picker'
import { createSubmit } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'ارسال پرامپت' }

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>
}) {
  const { done } = await searchParams
  const session = await auth()
  if (!session?.user) redirect('/login')

  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const categories = await prisma.category.findMany({ include: { subs: true } })

  return (
    <section className="container-app max-w-3xl py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {L(locale, 'ارسال پرامپت', 'Submit Prompt')}
      </h1>
      <p className="mt-3 text-sm leading-7 text-ink-muted">
        {L(
          locale,
          'پرامپت تو بعد از بررسی و تأیید ادمین، در سایت منتشر می‌شود و به نام تو ثبت خواهد شد.',
          'Your prompt will be published under your name after admin approval.'
        )}
      </p>

      {done && (
        <div className="glow-gold mt-6 rounded-2xl border border-success/40 bg-success/10 p-5 text-sm text-success">
          {L(
            locale,
            '✅ پرامپت تو با موفقیت ثبت شد و در صف بررسی است. بعد از تأیید، در سایت نمایش داده می‌شود.',
            '✅ Your prompt was submitted and is pending review.'
          )}
        </div>
      )}

      <form action={createSubmit} className="card mt-8 grid gap-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="titleFa" placeholder={L(locale, 'عنوان فارسی *', 'Persian title *')} className="input" required />
          <input name="titleEn" placeholder={L(locale, 'عنوان انگلیسی (اختیاری)', 'English title (optional)')} className="input" />
        </div>

        <input name="img" placeholder={L(locale, 'آدرس تصویر خروجی (https://...) *', 'Output image URL *')} className="input" required />

        <div className="grid gap-4 sm:grid-cols-3">
          <input name="model" placeholder={L(locale, 'مدل AI (Midjourney...) *', 'AI model *')} className="input" required />
          <select name="type" className="input">
            <option value="IMAGE">{L(locale, 'تصویر', 'Image')}</option>
            <option value="VIDEO">{L(locale, 'ویدیو', 'Video')}</option>
            <option value="TEXT">{L(locale, 'متن', 'Text')}</option>
            <option value="CODE">{L(locale, 'کد', 'Code')}</option>
            <option value="AUDIO">{L(locale, 'موسیقی', 'Music')}</option>
          </select>
          <select name="categoryId" className="input" required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{L(locale, c.nameFa, c.nameEn)}</option>
            ))}
          </select>
        </div>

        <select name="subId" className="input">
          <option value="">{L(locale, 'بدون زیردسته', 'No subcategory')}</option>
          {categories.flatMap((c) => c.subs).map((s) => (
            <option key={s.id} value={s.id}>{L(locale, s.fa, s.en)}</option>
          ))}
        </select>

        <div>
          <p className="mb-2 text-xs font-bold text-gold-bright">
            {L(locale, 'تگ‌ها (فقط از لیست مجاز — حداکثر ۴)', 'Tags (choose from list — max 4)')}
          </p>
          <TagPicker vocab={TAG_VOCAB} max={4} />
        </div>

        <textarea
          name="prompt"
          placeholder={L(locale, 'متن کامل پرامپت *', 'Full prompt text *')}
          rows={7}
          className="input resize-none font-mono"
          dir="ltr"
          required
        />

        <textarea
          name="usageFa"
          placeholder={L(locale, 'راهنمای استفاده (فارسی): مثلا در کدام مدل بگذارم، چه پارامترهایی بزنم، نکات مهم...', 'How to use (Persian)...')}
          rows={3}
          className="input resize-none"
        />

        <textarea
          name="usageEn"
          placeholder="How to use (English): which model, parameters, tips..."
          rows={3}
          className="input resize-none"
          dir="ltr"
        />

        <button type="submit" className="btn-primary w-fit">
          {L(locale, 'ارسال برای بررسی', 'Submit for review')}
        </button>
      </form>
    </section>
  )
}
