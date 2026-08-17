import Link from 'next/link'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { getArticles, L } from '@/lib/data'
import SafeImg from '@/components/safe-img'

export const metadata = { title: 'وبلاگ', description: 'آموزش‌های هوش مصنوعی' }
export const dynamic = 'force-dynamic'

export default async function BlogPage() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const articles = await getArticles()

  return (
    <section className="container-app py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {L(locale, 'وبلاگ و آموزش هوش مصنوعی', 'AI Blog & Tutorials')}
      </h1>

      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {articles.map((a) => (
          <Link
            key={a.id}
            href={'/blog/' + a.slug}
            className="card glow-gold overflow-hidden transition-transform hover:-translate-y-1"
          >
            <SafeImg src={a.img} alt={L(locale, a.titleFa, a.titleEn)} className="aspect-video w-full object-cover" />
            <div className="p-5">
              <span className="gold-badge">{L(locale, a.tagFa, a.tagEn)}</span>
              <h2 className="mt-3 font-display text-lg font-extrabold leading-snug">
                {L(locale, a.titleFa, a.titleEn)}
              </h2>
              <p className="mt-2 line-clamp-2 text-xs leading-6 text-ink-muted">
                {L(locale, a.descFa, a.descEn)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
