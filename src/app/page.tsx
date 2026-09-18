export const revalidate = 60
import HeroCanvas from '@/components/hero-canvas'
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
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const t = dictionaries[locale]

  const [categories, prompts, articles] = await Promise.all([
    getCategories(),
    getPrompts({ take: 12 }),
    getArticles({ take: 6 }),
  ])

  const imgPrompts = prompts.filter((p) => (p as any).type === 'IMAGE')
  const trending: typeof prompts = []
  for (const p of imgPrompts) {
    if (trending.length >= 5) break
    if (!trending.some((d) => d.categoryId === p.categoryId)) trending.push(p)
  }
  for (const p of imgPrompts) {
    if (trending.length >= 5) break
    if (!trending.includes(p)) trending.push(p)
  }

  return (
    <>
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
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <HeroCanvas />
        <div className="fx-blob anim-float" style={{ top: '-12%', right: '-14%', width: '46vw', height: '46vw' }} />
        <div className="fx-blob anim-float2" style={{ bottom: '-18%', left: '-12%', width: '40vw', height: '40vw' }} />
        <div className="fx-blob anim-float" style={{ top: '38%', left: '30%', width: '26vw', height: '26vw', opacity: 0.12 }} />
      </div>

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
        <section data-section className="snap-section flex min-h-[68vh] flex-col justify-center py-8">
          <div className="container-app">
            <Reveal>
              <div className="flex items-end justify-between gap-4">
                <h2 className="title-shine font-display text-2xl font-bold tracking-tight md:text-3xl">{t.trending}</h2>
                <Link href="/explore" className="btn-secondary whitespace-nowrap text-xs">{L(locale, 'مشاهده همه', 'View all')}</Link>
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
        <section data-section className="snap-section flex min-h-[68vh] flex-col justify-center border-t border-line/60 py-8">
          <div className="container-app">
            <Reveal>
              <div className="flex items-end justify-between gap-6">
                <h2 className="title-shine font-display text-2xl font-bold tracking-tight md:text-3xl">
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
                        src={a.img ? (a.img.includes('/upload/') ? a.img.replace('/upload/', '/upload/f_auto,q_auto,w_800/') : a.img) : ''}
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





