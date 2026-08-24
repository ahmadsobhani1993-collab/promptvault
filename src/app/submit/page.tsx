import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { getCategories, L } from '@/lib/data'
import { type Locale } from '@/lib/i18n'
import SubmitForm from '@/components/submit-form'

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
    let finalCategoryId = catId

    if (!finalCategoryId) {
      const firstCat = await prisma.category.findFirst()
      if (firstCat) {
        finalCategoryId = firstCat.id
      } else {
        // Fallback if no categories exist in the database yet
        const defaultCat = await prisma.category.create({
          data: {
            slug: 'general',
            nameFa: 'عمومی',
            nameEn: 'General',
            icon: 'Grid',
            descFa: 'دسته‌بندی عمومی',
            descEn: 'General Category',
          }
        })
        finalCategoryId = defaultCat.id
      }
    }

    const created = await prisma.prompt.create({
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
        categoryId: finalCategoryId,
        tagsFa: [],
        tagsEn: [],
        prompt,
        userId: s.user.id,
      },
    })
    
    fetch((process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir') + '/api/process-submit?id=' + created.id + '&key=' + (process.env.CRON_SECRET ?? ''), { signal: AbortSignal.timeout(8000) }).catch(() => {})
    redirect('/?sent=1')
  }

  return (
    <section className="container-app max-w-2xl py-16">
      <h1 className="font-display text-2xl font-extrabold">{L(locale, 'ارسال پرامپت', 'Submit prompt')}</h1>
      <p className="mt-2 text-xs text-ink-muted">{L(locale, 'پرامپت تو پس از تأیید ادمین منتشر می‌شود.', 'Your prompt will be published after admin approval.')}</p>

      <SubmitForm categories={categories} locale={locale} submitAction={submit} />
    </section>
  )
}
