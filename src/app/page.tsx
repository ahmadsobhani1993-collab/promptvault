import { cookies } from 'next/headers'
import { dictionaries, type Locale } from '@/lib/i18n'
import { getCategories, getPrompts, getArticles, L } from '@/lib/data'
import PromptCard from '@/components/prompt-card'
import Hero from '@/components/hero'
import ZoomSection from '@/components/zoom-section'
import DownButton from '@/components/down-button'
import CategoryGrid from '@/components/category-grid'
import Reveal from '@/components/reveal'
import Link from 'next/link'

const chips = [
  { fa: 'داغ‌ترین', en: 'Trending', href: '/explore?sort=trending' },
  { fa: 'جدید', en: 'New', href: '/explore?sort=newest' },
  { fa: 'تصویر', en: 'Image', href: '/explore?type=IMAGE' },
  { fa: 'ویدیو', en: 'Video', href: '/explore?type=VIDEO' },
  { fa: 'متن', en: 'Text', href: '/explore?type=TEXT' },
  { fa: 'کد', en: 'Code', href: '/explore?type=CODE' },
  { fa: 'موسیقی', en: 'Music', href: '/explore?type=AUDIO' },
]

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const t = dictionaries[locale]

  const [categories, prompts, articles] = await Promise.all([
    getCategories(),
    getPrompts({ take: 5 }),
    getArticles(),
  ])

  return (
    <>
      <ZoomSection>
        <Hero
          locale={locale}
          label={t.heroLabel}
          title={L(locale, 'با هوش مصنوعی باهوش کار کن.', 'Work smart with AI.')}
          subtitle={t.heroSubtitle}
          placeholder={t.searchPlaceholder}
          chips={chips}
        />
      </ZoomSection>

      <ZoomSection>
        <section data-section className="snap-section flex min-h-screen flex-col justify-center py-16">
          <div className="container-app">
            <Reveal>
              <h2 className="text-center font-display text-2xl font-bold tracking-tight md:text-3xl">
                {t.trending}
              </h2>
            </Reveal>

            <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
              {prompts.map((item, i) => (
                <Reveal key={item.id} delay={i * 90}>
                  <PromptCard item={item} locale={locale} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </ZoomSection>

      <ZoomSection>
        <section data-section className="snap-section flex min-h-screen flex-col justify-center border-t border-line/60 py-16">
          <div className="container-app">
            <Reveal>
              <h2 className="text-center font-display text-2xl font-bold tracking-tight md:text-3xl">
                {t.categoriesTitle}
              </h2>
            </Reveal>

            <Reveal delay={120}>
              <CategoryGrid
                items={categories.map((c) => ({
                  slug: c.slug,
                  icon: c.icon,
                  label: L(locale, c.nameFa, c.nameEn),
                }))}
              />
            </Reveal>
          </div>
        </section>
      </ZoomSection>

      <ZoomSection>
        <section data-section className="snap-section flex min-h-screen flex-col justify-center border-t border-line/60 py-16">
          <div className="container-app">
            <Reveal>
              <div className="flex items-end justify-between gap-6">
                <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                  {t.blogSection}
                </h2>
                <Link href="/blog" className="text-sm text-gold-bright hover:text-gold">
                  {L(locale, 'همه مقالات', 'All articles')}
                </Link>
              </div>
            </Reveal>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {articles.map((a, i) => (
                <Reveal key={a.id} delay={i * 120}>
                  <Link href={'/blog/' + a.slug} className="card group block overflow-hidden transition-colors hover:border-line-strong">
                    <div className="overflow-hidden">
                      <img
                        src={a.img}
                        alt={L(locale, a.titleFa, a.titleEn)}
                        loading="lazy"
                        className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="space-y-3 p-5">
                      <span className="gold-badge">{L(locale, a.tagFa, a.tagEn)}</span>
                      <h3 className="line-clamp-1 text-sm font-bold text-ink">
                        {L(locale, a.titleFa, a.titleEn)}
                      </h3>
                      <p className="line-clamp-2 text-xs leading-6 text-ink-muted">
                        {L(locale, a.descFa, a.descEn)}
                      </p>
                      <span className="block text-xs text-gold-bright">{t.readMore}</span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </ZoomSection>

      <DownButton />
    </>
  )
}
