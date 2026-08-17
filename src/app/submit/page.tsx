import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { getCategories, L } from '@/lib/data'
import { type Locale } from '@/lib/i18n'
import UploadInput from '@/components/upload-input'

export const metadata = { title: 'ارسال پرامپت | PromptsFA' }
export const dynamic = 'force-dynamic'

export default async function SubmitPage() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const session = await auth()
  const categories = await getCategories()

  if (!session?.user) {
    return (
      <section className="container-app grid min-h-[60vh] place-items-center py-16">
        <div className="card max-w-md p-8 text-center">
          <p className="text-sm text-ink-muted">{L(locale, 'برای ارسال پرامپت ابتدا وارد شو.', 'Please login to submit.')}</p>
          <a href="/login" className="btn-primary mt-5 inline-flex">{L(locale, 'ورود', 'Login')}</a>
        </div>
      </section>
    )
  }

  async function submit(fd: FormData) {
    'use server'
    const s = await auth()
    if (!s?.user?.id) return redirect('/login')
    const img = String(fd.get('img') ?? '')
    const title = String(fd.get('title') ?? '').trim()
    const prompt = String(fd.get('prompt') ?? '').trim()
    if (!img || !title || !prompt) return
    const catId = String(fd.get('category') ?? '')
    await prisma.prompt.create({
      data: {
        titleFa: title,
        titleEn: title,
        descFa: String(fd.get('desc') ?? '').trim(),
        descEn: String(fd.get('desc') ?? '').trim(),
        usageFa: '',
        usageEn: '',
        slug: 'u-' + Date.now(),
        img,
        model: 'AI',
        type: 'IMAGE',
        status: 'PENDING',
        categoryId: catId || (await prisma.category.findFirst())!.id,
        tagsFa: [],
        tagsEn: [],
        prompt,
        userId: s.user.id,
      },
    })
    redirect('/?sent=1')
  }

  return (
    <section className="container-app max-w-2xl py-16">
      <h1 className="font-display text-2xl font-extrabold">{L(locale, 'ارسال پرامپت', 'Submit prompt')}</h1>
      <p className="mt-2 text-xs text-ink-muted">{L(locale, 'پرامپت تو پس از تأیید ادمین منتشر می‌شود.', 'Your prompt will be published after admin approval.')}</p>

      <form action={submit} className="card mt-8 space-y-5 p-6">
        <UploadInput label={L(locale, 'آپلود تصویر (حداکثر ۱ مگابایت)', 'Upload image (max 1MB)')} tooBigMsg={L(locale, 'حجم تصویر باید کمتر از ۱ مگابایت باشد', 'Image must be under 1MB')} />

        <input name="title" required placeholder={L(locale, 'عنوان', 'Title')} className="input" />
        <textarea name="prompt" required rows={5} placeholder={L(locale, 'متن پرامپت', 'Prompt text')} className="input resize-none" />
        <textarea name="desc" rows={2} placeholder={L(locale, 'توضیح کوتاه (اختیاری)', 'Short description (optional)')} className="input resize-none" />

        <select name="category" className="input">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{L(locale, c.nameFa, c.nameEn)}</option>
          ))}
        </select>

        <button type="submit" className="btn-primary w-full justify-center">{L(locale, 'ارسال برای بررسی', 'Submit for review')}</button>
      </form>
    </section>
  )
}
