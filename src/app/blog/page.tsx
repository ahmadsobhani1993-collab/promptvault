import Link from 'next/link'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { articles, L } from '@/lib/data'

export const metadata = {
  title: 'وبلاگ',
  description: 'آموزش و مقالات هوش مصنوعی',
}

export default async function BlogPage() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  return (
    <section className="container-app py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {L(locale, 'وبلاگ و آموزش هوش مصنوعی', 'AI Blog & Tutorials')}
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-ink-muted">
        {L(
          locale,
          'مقالات آموزشی برای اینکه بهتر بسازی، بهتر بنویسی و بهتر فکر کنی.',
          'Educational articles to build better, write better, and think better.'
        )}
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <Link key={a.slug} href={'/blog/' + a.slug} className="card group overflow-hidden transition-colors hover:border-line-strong">
            <img src={a.img} alt={L(locale, a.titleFa, a.titleEn)} loading="lazy" className="h-48 w-full object-cover" />
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="gold-badge">{L(locale, a.tagFa, a.tagEn)}</span>
                <span className="text-[10px] text-ink-faint">{L(locale, a.dateFa, a.dateEn)}</span>
              </div>
              <h2 className="text-sm font-bold text-ink">{L(locale, a.titleFa, a.titleEn)}</h2>
              <p className="line-clamp-2 text-xs leading-6 text-ink-muted">
                {L(locale, a.descFa, a.descEn)}
              </p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gold-bright">{L(locale, 'ادامه مطلب', 'Read more')}</span>
                <span className="text-ink-faint">{L(locale, a.readFa, a.readEn)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
