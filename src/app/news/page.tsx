import Link from 'next/link'
import type { Metadata } from 'next'
import type { Locale } from '@/lib/i18n'
import { getArticles, L } from '@/lib/data'
import { getRequestLocale } from '@/lib/request-locale'
import { localizedPath } from '@/lib/locale-path'
import SafeImg from '@/components/safe-img'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  const prefix = locale === 'en' ? '/en' : ''
  return {
    title: L(locale, 'اخبار هوش مصنوعی | PromptsFA', 'AI news | PromptsFA'),
    description: L(locale, 'تازه‌ترین خبرهای هوش مصنوعی، بازنویسی و بررسی‌شده به فارسی و انگلیسی.', 'The latest AI news, rewritten and reviewed in Persian and English.'),
    alternates: {
      canonical: `https://promptsfa.ir${prefix}/news`,
      languages: {
        'fa-IR': 'https://promptsfa.ir/news',
        'en-US': 'https://promptsfa.ir/en/news',
      },
    },
  }
}

export default async function NewsPage() {
  const locale: Locale = await getRequestLocale()
  const articles = await getArticles({ tagFa: 'اخبار', take: 48 })

  return (
    <section className="container-app py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-bright">{L(locale, 'تازه و مهم', 'Latest stories')}</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">{L(locale, 'اخبار هوش مصنوعی', 'AI news')}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted">{L(locale, 'خبرهای تازهٔ هوش مصنوعی، به دو زبان و همراه با ارجاع به منبع اصلی.', 'Recent AI developments in both languages, with links to their original sources.')}</p>
        </div>
        <Link href={localizedPath(locale, '/blog')} className="btn-secondary text-xs">{L(locale, 'بازگشت به وبلاگ', 'Back to the blog')} →</Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {articles.map((article) => (
          <Link key={article.id} href={localizedPath(locale, `/blog/${article.slug}`)} className="group card overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-gold/40">
            <div className="overflow-hidden">
              <SafeImg src={article.img} alt={L(locale, article.titleFa, article.titleEn)} className="aspect-[16/9] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
            </div>
            <div className="flex min-h-40 flex-col p-4">
              <span className="gold-badge self-start text-[10px]">{L(locale, 'اخبار هوش مصنوعی', 'AI news')}</span>
              <h2 className="mt-3 line-clamp-2 font-display text-sm font-bold leading-6 md:text-[15px]">{L(locale, article.titleFa, article.titleEn)}</h2>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-ink-muted">{L(locale, article.descFa, article.descEn)}</p>
              <span className="mt-auto pt-3 text-[11px] font-semibold text-gold-bright">{L(locale, 'ادامه مطلب', 'Read story')} →</span>
            </div>
          </Link>
        ))}
      </div>
      {articles.length === 0 && <p className="mt-10 text-sm text-ink-muted">{L(locale, 'خبر تازه‌ای برای نمایش نیست.', 'There are no news stories to show yet.')}</p>}
    </section>
  )
}
