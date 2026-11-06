import Link from 'next/link'
import { getRequestLocale } from '@/lib/request-locale'
import { L } from '@/lib/l'
import { localizedPath } from '@/lib/locale-path'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const locale = await getRequestLocale()
  return { title: L(locale, 'پروفایل کاربر | PromptsFA', 'User profile | PromptsFA') }
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const [{ username }, locale] = await Promise.all([params, getRequestLocale()])
  return (
    <section className="container-app py-20" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <div className="card p-12 text-center">
        <div className="text-6xl mb-6">🚧</div>
        <h1 className="font-display text-2xl font-bold text-gold-bright mb-4">
          {L(locale, 'پروفایل کاربر', 'User profile')}
        </h1>
        <p className="text-ink-muted mb-8">
          {L(locale, `صفحهٔ عمومی @${username} هنوز آماده نشده است.`, `The public profile for @${username} is not available yet.`)}
        </p>
        <Link href={localizedPath(locale, '/')} className="btn-primary inline-block">
          {L(locale, 'بازگشت به صفحه اصلی', 'Back to home')}
        </Link>
      </div>
    </section>
  )
}
