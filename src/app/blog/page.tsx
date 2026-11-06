import Link from 'next/link'
import { type Locale } from '@/lib/i18n'
import { getArticles, L } from '@/lib/data'
import { getRequestLocale } from '@/lib/request-locale'
import { localizedPath } from '@/lib/locale-path'
import SafeImg from '@/components/safe-img'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const locale = await getRequestLocale()
  return {
    title: L(locale, 'وبلاگ و آموزش هوش مصنوعی | PromptsFA', 'AI blog and guides | PromptsFA'),
    description: L(locale, 'راهنماها و آموزش‌های کاربردی هوش مصنوعی', 'Practical artificial intelligence guides and tutorials'),
  }
}

export default async function BlogPage() {
  const locale: Locale = await getRequestLocale()
  const articles = await getArticles({ excludeTagFa: 'اخبار' })

  return (
    <section className="container-app py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-bright">{L(locale, 'دانشنامه PromptsFA', 'PromptsFA journal')}</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">{L(locale, 'وبلاگ و آموزش', 'Blog and guides')}</h1>
        </div>
        <Link href={localizedPath(locale, '/news')} className="btn-secondary text-xs">
          {L(locale, 'آخرین اخبار هوش مصنوعی', 'Latest AI news')} →
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {articles.map((a) => (
          <Link key={a.id} href={localizedPath(locale, '/blog/' + a.slug)} className="group card overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-gold/40 hover:shadow-lg">
            <div className="relative overflow-hidden">
              <SafeImg src={a.img} alt={L(locale, a.titleFa, a.titleEn)} className="aspect-[16/9] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
            </div>
            <div className="flex min-h-40 flex-col p-4">
              <span className="gold-badge self-start text-[10px]">{L(locale, a.tagFa, a.tagEn)}</span>
              <h2 className="mt-3 line-clamp-2 font-display text-sm font-bold leading-6 md:text-[15px]">{L(locale, a.titleFa, a.titleEn)}</h2>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-ink-muted">{L(locale, a.descFa, a.descEn)}</p>
              <span className="mt-auto pt-3 text-[11px] font-semibold text-gold-bright">{L(locale, 'ادامه مطلب', 'Read article')} →</span>
            </div>
          </Link>
        ))}
      </div>
      {articles.length === 0 && <p className="mt-10 text-sm text-ink-muted">{L(locale, 'هنوز مقاله‌ای منتشر نشده است.', 'No articles have been published yet.')}</p>}
    </section>
  )
}
