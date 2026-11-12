export const revalidate = 60
import { dictionaries, type Locale } from '@/lib/i18n'
import { getCategories, getPrompts, getArticles, L } from '@/lib/data'
import { getRequestLocale } from '@/lib/request-locale'
import HomeToolsOrbit from '@/components/home-tools-orbit'
import PromptCard from '@/components/prompt-card'
import Hero from '@/components/hero'
import ZoomSection from '@/components/zoom-section'
import CategoryGrid from '@/components/category-grid'
import Reveal from '@/components/reveal'
import { getArticleCardImageUrl } from '@/lib/image-utils'
import Link from 'next/link'
import { localizedPath } from '@/lib/locale-path'

const chips = [
  { fa: 'داغ‌ترین', en: 'Trending', href: '/explore?sort=trending' },
  { fa: 'جدید', en: 'New', href: '/explore?sort=newest' },
  { fa: 'تصویر', en: 'Image', href: '/explore?type=IMAGE' },
  { fa: 'ویدیو', en: 'Video', href: '/explore?type=VIDEO' },
  { fa: 'متن', en: 'Text', href: '/explore?type=TEXT' },
  { fa: 'کد', en: 'Code', href: '/explore?type=CODE' },
  { fa: 'موسیقی', en: 'Music', href: '/explore?type=AUDIO' },
]

export const metadata = {
  title: 'پرامپت یار | مرجع دانلود و کپی پرامپت هوش مصنوعی فارسی و انگلیسی',
  description: 'هزاران پرامپت حرفه‌ای و تست‌شده برای میدجورنی (Midjourney)، چت جی پی تی (ChatGPT)، ساخت عکس با هوش مصنوعی، پرامپت ویدیوساز و تولید محتوا به زبان فارسی.',
    keywords: [
    'پرامپت هوش مصنوعی',
    'پرامپت فارسی',
    'پرامپت میدجورنی',
    'پرامپت عکس',
    'پرامپت چت جی پی تی',
    'هوش مصنوعی فارسی',
    'استودیو زیرنویس هوش مصنوعی',
    'AI prompts',
    'Midjourney prompts',
    'ChatGPT prompts library',
    'AI image prompt generator',
    'Stable Diffusion prompts',
    'PromptsFA',
    'Realistic portrait prompt',
    'AI video captions'
  ],
  alternates: {
    canonical: 'https://promptsfa.ir',
    languages: {
      'fa-IR': 'https://promptsfa.ir',
      'en-US': 'https://promptsfa.ir/en',
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'پرامپت یار | مرجع تخصصی پرامپت‌های هوش مصنوعی',
    description: 'کشف، کپی تمیز و شخصی‌سازی هزاران پرامپت واقعی هوش مصنوعی برای تولید عکس، ویدیو و متن.',
    siteName: 'PromptsFA',
    locale: 'fa_IR',
    url: 'https://promptsfa.ir',
    images: [{ url: 'https://promptsfa.ir/icon.svg', width: 800, height: 800, alt: 'PromptsFA' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'پرامپت یار | مرجع پرامپت هوش مصنوعی',
    description: 'کامل‌ترین کالکشن پرامپت‌های میدجورنی و چت‌جی‌پی‌تی به همراه ویرایشگر هوشمند.',
  },
}

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const locale: Locale = await getRequestLocale()
  const t = dictionaries[locale]

  const [categories, prompts, articles, news] = await Promise.all([
    getCategories(),
    getPrompts({ type: 'IMAGE', take: 12 }),
    getArticles({ take: 4, excludeTagFa: 'اخبار' }),
    getArticles({ take: 4, tagFa: 'اخبار' }),
  ])

  const trending: typeof prompts = []
  for (const p of prompts) {
    if (trending.length >= 5) break
    if (!trending.some((d) => d.categoryId === p.categoryId)) trending.push(p)
  }
  for (const p of prompts) {
    if (trending.length >= 5) break
    if (!trending.includes(p)) trending.push(p)
  }

  return (
    <div className="relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'PromptsFA',
            url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir',
            potentialAction: {
              '@type': 'SearchAction',
              target: (process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir') + '/explore?q={search_term_string}',
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />
      <ZoomSection>
        <Hero
          locale={locale}
          label={t.heroLabel}
          title={L(locale, 'یک دکمه فاصله بین ایده و عمل', 'One button between idea and action')}
          placeholder={t.searchPlaceholder}
          chips={chips}
        />
      </ZoomSection>

      <ZoomSection>
        <section id="trending" data-section className="snap-section flex min-h-[68vh] flex-col justify-center py-8">
          <div className="container-app">
            <Reveal>
              <div className="flex items-end justify-between gap-4">
                <h2 className="title-shine font-display text-2xl font-bold tracking-tight md:text-3xl">{t.trending}</h2>
                <Link href={localizedPath(locale, '/explore')} className="btn-secondary whitespace-nowrap text-xs">{L(locale, 'مشاهده همه', 'View all')}</Link>
              </div>
            </Reveal>

            <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
              {trending.map((item, i) => (
                <Reveal key={item.id} delay={i * 90}>
                  <PromptCard item={item} locale={locale} isNew={Date.now() - new Date(item.createdAt).getTime() < 48 * 3600 * 1000} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </ZoomSection>

      <ZoomSection>
        <section data-section className="snap-section flex min-h-[68vh] flex-col justify-center border-t border-line/60 py-8">
          <div className="container-app">
            <Reveal>
              <h2 className="title-shine text-center font-display text-2xl font-bold tracking-tight md:text-3xl">
                {t.categoriesTitle}
              </h2>
            </Reveal>

            <Reveal delay={120}>
              <div className="anim-float">
                <CategoryGrid
                  locale={locale}
                  items={categories.map((c) => ({
                    slug: c.slug,
                    icon: c.icon,
                    label: L(locale, c.nameFa, c.nameEn),
                  }))}
                />
              </div>
            </Reveal>
          </div>
        </section>
      </ZoomSection>

      <ZoomSection>
        <HomeToolsOrbit locale={locale} />
      </ZoomSection>

      {[
        {
          key: 'articles',
          title: L(locale, 'مقالات و آموزش هوش مصنوعی', 'AI articles and tutorials'),
          href: '/blog',
          linkLabel: L(locale, 'همه مقالات', 'All articles'),
          sourcesTitle: L(locale, 'خبرنامه‌های روزانه', 'Daily newsletters'),
          sources: [
            { name: 'Superhuman AI', href: 'https://www.superhuman.ai/' },
            { name: "Ben's Bites", href: 'https://www.bensbites.com/' },
            { name: 'Mindstream', href: 'https://www.mindstream.news/' },
          ],
          items: articles,
        },
        {
          key: 'news',
          title: L(locale, 'اخبار هوش مصنوعی', 'AI news'),
          href: '/news',
          linkLabel: L(locale, 'همه اخبار', 'All news'),
          sourcesTitle: L(locale, 'منابع خبری', 'News sources'),
          sources: [
            { name: 'The Verge', href: 'https://www.theverge.com/ai-artificial-intelligence' },
            { name: 'WIRED', href: 'https://www.wired.com/tag/artificial-intelligence/' },
            { name: 'Mashable', href: 'https://mashable.com/category/artificial-intelligence' },
            { name: 'CNET', href: 'https://www.cnet.com/tech/services-and-software/ai/' },
          ],
          items: news,
        },
      ].map((section) => (
        <ZoomSection key={section.key}>
          <section data-section className="snap-section flex min-h-[68vh] flex-col justify-center border-t border-line/60 py-8">
            <div className="container-app">
              <Reveal>
                <div className="flex items-end justify-between gap-6">
                  <h2 className="title-shine font-display text-2xl font-bold tracking-tight md:text-3xl">
                    {section.title}
                  </h2>
                  <Link href={localizedPath(locale, section.href)} className="whitespace-nowrap text-sm text-gold-bright hover:text-gold">
                    {section.linkLabel}
                  </Link>
                </div>
              </Reveal>

              <nav aria-label={section.sourcesTitle} className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-muted">{section.sourcesTitle}:</span>
                {section.sources.map((source) => (
                  <a
                    key={source.href}
                    href={source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-line/60 bg-black/20 px-3 py-1 text-[11px] text-ink-muted transition-colors hover:border-gold/40 hover:text-gold-bright"
                  >
                    {source.name}
                  </a>
                ))}
              </nav>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {section.items.map((a, i) => (
                  <Reveal key={a.id} delay={i * 90}>
                    <Link href={localizedPath(locale, '/blog/' + a.slug)} className="card group block h-full overflow-hidden transition-colors hover:border-line-strong">
                      <div className="overflow-hidden">
                        <img
                          src={getArticleCardImageUrl(a.img, 600)}
                          alt={L(locale, a.titleFa, a.titleEn)}
                          loading="lazy"
                          decoding="async"
                          className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="space-y-2 p-4">
                        <span className="gold-badge">{L(locale, a.tagFa, a.tagEn)}</span>
                        <h3 className="line-clamp-2 text-sm font-bold leading-6 text-ink">
                          {L(locale, a.titleFa, a.titleEn)}
                        </h3>
                        <p className="line-clamp-2 text-xs leading-5 text-ink-muted">
                          {L(locale, a.descFa, a.descEn)}
                        </p>
                        <span className="block pt-1 text-xs text-gold-bright">{t.readMore}</span>
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </div>
              {section.items.length === 0 && (
                <p className="mt-6 text-sm text-ink-muted">
                  {section.key === 'news'
                    ? L(locale, 'خبر تازه‌ای برای نمایش نیست.', 'There are no news stories to show yet.')
                    : L(locale, 'مقاله‌ای برای نمایش نیست.', 'There are no articles to show yet.')}
                </p>
              )}
            </div>
          </section>
        </ZoomSection>
      ))}
    </div>
  )
}
