import { cookies } from 'next/headers'
import { auth } from '@/auth'
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

  return (
    <section className="container-app max-w-2xl py-16">
      <h1 className="font-display text-2xl font-extrabold">{L(locale, 'ارسال پرامپت', 'Submit prompt')}</h1>
      <p className="mt-2 text-xs text-ink-muted">{L(locale, 'پرامپت تو پس از تأیید ادمین منتشر می‌شود.', 'Your prompt will be published after admin approval.')}</p>

      <SubmitForm categories={categories} locale={locale} />
    </section>
  )
}
