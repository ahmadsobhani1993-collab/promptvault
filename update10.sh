#!/bin/bash
set -e

cat > src/lib/data.ts << 'EOF'
import type { Locale } from '@/lib/i18n'
import { prisma } from '@/lib/db'

export const L = (locale: Locale, fa: string, en: string) =>
  locale === 'fa' ? fa : en

export interface PromptType {
  value: string
  fa: string
  en: string
}

export const promptTypes: PromptType[] = [
  { value: 'IMAGE', fa: 'تصویر', en: 'Image' },
  { value: 'VIDEO', fa: 'ویدیو', en: 'Video' },
  { value: 'TEXT', fa: 'متن', en: 'Text' },
  { value: 'CODE', fa: 'کد', en: 'Code' },
  { value: 'AUDIO', fa: 'موسیقی', en: 'Music' },
]

export const getPromptTypeLabel = (type: string, locale: Locale) => {
  const t = promptTypes.find((x) => x.value === type)
  return t ? L(locale, t.fa, t.en) : type
}

export async function getCategories() {
  return prisma.category.findMany({
    orderBy: { order: 'asc' },
    include: { subs: true },
  })
}

export async function getPrompts(opts?: {
  type?: string
  q?: string
  categorySlug?: string
  subSlug?: string
  take?: number
}) {
  const where: any = {}
  if (opts?.type) where.type = opts.type
  if (opts?.categorySlug) {
    where.category = { slug: opts.categorySlug }
  }
  if (opts?.subSlug) {
    where.sub = { slug: opts.subSlug }
  }
  if (opts?.q) {
    const q = opts.q
    where.OR = [
      { titleFa: { contains: q, mode: 'insensitive' } },
      { titleEn: { contains: q, mode: 'insensitive' } },
      { prompt: { contains: q, mode: 'insensitive' } },
    ]
  }

  return prisma.prompt.findMany({
    where,
    orderBy: { likes: 'desc' },
    take: opts?.take,
    include: { category: true, sub: true },
  })
}

export async function getPromptBySlug(slug: string) {
  return prisma.prompt.findUnique({
    where: { slug },
    include: { category: true, sub: true },
  })
}

export async function getRelatedPrompts(categoryId: string, excludeSlug: string) {
  return prisma.prompt.findMany({
    where: { categoryId, NOT: { slug: excludeSlug } },
    orderBy: { likes: 'desc' },
    take: 3,
    include: { category: true, sub: true },
  })
}

export async function getArticles() {
  return prisma.article.findMany({ orderBy: { createdAt: 'desc' } })
}

export async function getArticleBySlug(slug: string) {
  return prisma.article.findUnique({ where: { slug } })
}
EOF

cat > src/app/page.tsx << 'EOF'
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
EOF

cat > src/app/explore/page.tsx << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { getPrompts, promptTypes, L, getPromptTypeLabel } from '@/lib/data'
import PromptCard from '@/components/prompt-card'

export const metadata = { title: 'کاوش', description: 'جستجو و فیلتر پرامپت‌ها' }
export const dynamic = 'force-dynamic'

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>
}) {
  const params = await searchParams
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const prompts = await getPrompts({ type: params.type, q: params.q })

  return (
    <section className="container-app py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {L(locale, 'کاوش', 'Explore')}
      </h1>

      <form action="/explore" className="mt-6 max-w-2xl">
        <input
          name="q"
          defaultValue={params.q ?? ''}
          placeholder={L(locale, 'جستجو در پرامپت‌ها...', 'Search prompts...')}
          className="input text-base"
        />
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/explore"
          className={'rounded-full border px-4 py-1.5 text-xs ' + (!params.type ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted')}
        >
          {L(locale, 'همه', 'All')}
        </Link>
        {promptTypes.map((tp) => (
          <Link
            key={tp.value}
            href={'/explore?type=' + tp.value}
            className={'rounded-full border px-4 py-1.5 text-xs ' + (params.type === tp.value ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted')}
          >
            {L(locale, tp.fa, tp.en)}
          </Link>
        ))}
      </div>

      {prompts.length > 0 ? (
        <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
          {prompts.map((item) => (
            <PromptCard key={item.id} item={item} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="card mt-10 p-10 text-center text-sm text-ink-muted">
          {L(locale, 'نتیجه‌ای پیدا نشد.', 'No results found.')}
        </div>
      )}
    </section>
  )
}
EOF

cat > src/app/categories/page.tsx << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { getCategories, L } from '@/lib/data'
import CategoryIcon from '@/components/category-icon'

export const metadata = { title: 'دسته‌بندی‌ها' }
export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const categories = await getCategories()

  return (
    <section className="container-app py-16">
      <h1 className="text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        {L(locale, 'دسته‌بندی‌ها', 'Categories')}
      </h1>

      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={'/categories/' + cat.slug}
            className="card-cream glow-gold flex items-start gap-5 p-6 transition-transform hover:-translate-y-1"
          >
            <div className="text-[#171512]">
              <CategoryIcon name={cat.icon} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#171512]">
                {L(locale, cat.nameFa, cat.nameEn)}
              </h2>
              <p className="mt-2 text-xs leading-6 text-[#6b6353]">
                {L(locale, cat.descFa, cat.descEn)}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {cat.subs.map((s) => (
                  <span key={s.id} className="rounded-full bg-[#e7dcc4] px-2 py-0.5 text-[10px] text-[#5c5443]">
                    {L(locale, s.fa, s.en)}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
EOF

cat > 'src/app/categories/[slug]/page.tsx' << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { type Locale } from '@/lib/i18n'
import { getCategories, getPrompts, L } from '@/lib/data'
import PromptCard from '@/components/prompt-card'
import CategoryIcon from '@/components/category-icon'

export const dynamic = 'force-dynamic'

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sub?: string }>
}) {
  const { slug } = await params
  const { sub } = await searchParams
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const categories = await getCategories()
  const cat = categories.find((c) => c.slug === slug)
  if (!cat) notFound()

  const list = await getPrompts({ categorySlug: slug, subSlug: sub })

  return (
    <section className="container-app py-16">
      <div className="flex items-center gap-5">
        <div className="glow-gold rounded-2xl bg-[#F2EAD8] p-4 text-[#171512]">
          <CategoryIcon name={cat.icon} />
        </div>
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            {L(locale, cat.nameFa, cat.nameEn)}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {L(locale, cat.descFa, cat.descEn)}
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          href={'/categories/' + slug}
          className={'rounded-full border px-4 py-1.5 text-xs ' + (!sub ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted')}
        >
          {L(locale, 'همه', 'All')}
        </Link>
        {cat.subs.map((s) => (
          <Link
            key={s.id}
            href={'/categories/' + slug + '?sub=' + s.slug}
            className={'rounded-full border px-4 py-1.5 text-xs ' + (sub === s.slug ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted')}
          >
            {L(locale, s.fa, s.en)}
          </Link>
        ))}
      </div>

      {list.length > 0 ? (
        <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
          {list.map((item) => (
            <PromptCard key={item.id} item={item} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="card mt-10 p-10 text-center text-sm text-ink-muted">
          {L(locale, 'به‌زودی پرامپت‌های این بخش اضافه می‌شود.', 'Prompts coming soon.')}
        </div>
      )}
    </section>
  )
}
EOF

cat > src/app/prompts/page.tsx << 'EOF'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { getPrompts, L } from '@/lib/data'
import PromptCard from '@/components/prompt-card'

export const metadata = { title: 'پرامپت‌ها' }
export const dynamic = 'force-dynamic'

export default async function PromptsPage() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const prompts = await getPrompts()

  return (
    <section className="container-app py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {L(locale, 'همه پرامپت‌ها', 'All Prompts')}
      </h1>
      <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
        {prompts.map((item) => (
          <PromptCard key={item.id} item={item} locale={locale} />
        ))}
      </div>
    </section>
  )
}
EOF

cat > 'src/app/prompts/[slug]/page.tsx' << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { type Locale } from '@/lib/i18n'
import { getPromptBySlug, getRelatedPrompts, getPromptTypeLabel, L } from '@/lib/data'
import PromptCard from '@/components/prompt-card'
import CopyButton from '@/components/copy-button'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const item = await getPromptBySlug(slug)
  if (!item) return {}
  return { title: item.titleFa, description: item.prompt.slice(0, 150) }
}

export const dynamic = 'force-dynamic'

export default async function PromptDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const item = await getPromptBySlug(slug)
  if (!item) notFound()

  const related = await getRelatedPrompts(item.categoryId, slug)

  return (
    <section className="container-app py-16">
      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <img src={item.img} alt={L(locale, item.titleFa, item.titleEn)} className="glow-gold w-full rounded-2xl object-cover" />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={'/categories/' + item.category.slug} className="gold-badge">
              {L(locale, item.category.nameFa, item.category.nameEn)}
            </Link>
            <span className="badge">{getPromptTypeLabel(item.type, locale)}</span>
            <span className="badge">{item.model}</span>
          </div>

          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">
            {L(locale, item.titleFa, item.titleEn)}
          </h1>

          <div className="mt-4 flex items-center gap-5 text-xs text-ink-muted">
            <span>{item.likes} {L(locale, 'پسند', 'likes')}</span>
            <span>{item.saves} {L(locale, 'ذخیره', 'saves')}</span>
            <span>{item.views} {L(locale, 'بازدید', 'views')}</span>
          </div>

          <div className="mt-5 flex flex-wrap gap-1">
            {item.tagsFa.map((tag, i) => L(locale, tag, item.tagsEn[i] ?? tag)).map((tag) => (
              <span key={tag} className="badge">{tag}</span>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-gold/40 bg-[#0d0b07] p-5">
            <p className="text-xs font-bold text-gold-bright">Prompt</p>
            <p dir="ltr" className="mt-3 text-left font-mono text-sm leading-7 text-[#e8d9ae]">
              {item.prompt}
            </p>
            <div className="mt-5">
              <CopyButton
                text={item.prompt}
                label={L(locale, 'کپی پرامپت', 'Copy Prompt')}
                copiedLabel={L(locale, 'کپی شد!', 'Copied!')}
              />
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-20">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {L(locale, 'پرامپت‌های مشابه', 'Related prompts')}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3">
            {related.map((r) => (
              <PromptCard key={r.id} item={r} locale={locale} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
EOF

cat > src/app/blog/page.tsx << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { getArticles, L } from '@/lib/data'

export const metadata = { title: 'وبلاگ' }
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

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <Link key={a.id} href={'/blog/' + a.slug} className="card group overflow-hidden transition-colors hover:border-line-strong">
            <img src={a.img} alt={L(locale, a.titleFa, a.titleEn)} loading="lazy" className="h-48 w-full object-cover" />
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="gold-badge">{L(locale, a.tagFa, a.tagEn)}</span>
                <span className="text-[10px] text-ink-faint">{L(locale, a.dateFa, a.dateEn)}</span>
              </div>
              <h2 className="text-sm font-bold text-ink">{L(locale, a.titleFa, a.titleEn)}</h2>
              <p className="line-clamp-2 text-xs leading-6 text-ink-muted">{L(locale, a.descFa, a.descEn)}</p>
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
EOF

cat > 'src/app/blog/[slug]/page.tsx' << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { type Locale } from '@/lib/i18n'
import { getArticleBySlug, getArticles, getPrompts, L } from '@/lib/data'
import PromptCard from '@/components/prompt-card'
import LikeButton from '@/components/like-button'
import CommentBox from '@/components/comment-box'

const relatedMap: Record<string, { fa: string; en: string }[]> = {
  'midjourney-starter': [{ fa: 'سینمایی', en: 'cinematic' }, { fa: 'محصول', en: 'product' }],
  'better-prompts': [{ fa: 'تبلیغات', en: 'ads' }, { fa: 'فانتزی', en: 'fantasy' }],
  'flux-vs-sd': [{ fa: 'لوکس', en: 'luxury' }, { fa: 'آینده', en: 'future' }],
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const a = await getArticleBySlug(slug)
  if (!a) return {}
  return { title: a.titleFa, description: a.descFa }
}

export const dynamic = 'force-dynamic'

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const a = await getArticleBySlug(slug)
  if (!a) notFound()

  const allArticles = await getArticles()
  const others = allArticles.filter((x) => x.slug !== slug)
  const content = locale === 'fa' ? a.contentFa : a.contentEn

  const keywords = relatedMap[slug] ?? []
  let related = []
  if (keywords.length > 0) {
    const allPrompts = await getPrompts()
    related = allPrompts.filter((p) => {
      const tags = locale === 'fa' ? p.tagsFa : p.tagsEn
      return keywords.some((k) => tags.some((t) => t.toLowerCase() === k[locale].toLowerCase()))
    }).slice(0, 3)
  }

  return (
    <article className="container-app max-w-4xl py-16">
      <Link href="/blog" className="text-xs text-gold-bright hover:text-gold">
        {L(locale, '← بازگشت به وبلاگ', '← Back to blog')}
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href={'/explore?q=' + encodeURIComponent(L(locale, a.tagFa, a.tagEn))}
          className="gold-badge transition-colors hover:bg-gold/20"
        >
          {L(locale, a.tagFa, a.tagEn)}
        </Link>
        <span className="text-xs text-ink-faint">{L(locale, a.dateFa, a.dateEn)}</span>
        <span className="text-xs text-ink-faint">{L(locale, a.readFa, a.readEn)}</span>
      </div>

      <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        {L(locale, a.titleFa, a.titleEn)}
      </h1>

      <img src={a.img} alt={L(locale, a.titleFa, a.titleEn)} className="glow-gold mt-8 w-full rounded-2xl object-cover" />

      <div className="mt-8 space-y-6">
        {content.map((p, i) => (
          <p key={i} className="text-base leading-8 text-ink-muted">{p}</p>
        ))}
      </div>

      <div className="mt-10 flex items-center gap-3">
        <LikeButton initial={128} label={L(locale, 'پسند', 'likes')} />
      </div>

      {related.length > 0 && (
        <div className="mt-14">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {L(locale, 'پرامپت‌های مرتبط', 'Related prompts')}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3">
            {related.map((r) => (
              <PromptCard key={r.id} item={r} locale={locale} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-14">
        <h2 className="font-display text-xl font-bold tracking-tight">
          {L(locale, 'سایر مقالات', 'More articles')}
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {others.map((o) => (
            <Link key={o.id} href={'/blog/' + o.slug} className="card flex items-center gap-4 p-4 transition-colors hover:border-line-strong">
              <img src={o.img} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <div>
                <p className="line-clamp-1 text-sm font-bold text-ink">{L(locale, o.titleFa, o.titleEn)}</p>
                <p className="mt-1 text-[10px] text-ink-faint">{L(locale, o.readFa, o.readEn)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <CommentBox
        initial={[
          { name: 'سارا', text: L(locale, 'عالی بود!', 'Great!') },
          { name: 'Ali', text: L(locale, 'نکات کاربردی.', 'Practical tips.') },
        ]}
        titleLabel={L(locale, 'دیدگاه‌ها', 'Comments')}
        namePlaceholder={L(locale, 'نام تو', 'Your name')}
        textPlaceholder={L(locale, 'دیدگاهت را بنویس...', 'Write your comment...')}
        submitLabel={L(locale, 'ارسال دیدگاه', 'Submit')}
      />
    </article>
  )
}
EOF

cat > src/components/prompt-card.tsx << 'EOF'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n'
import { L, getPromptTypeLabel } from '@/lib/data'

type PromptItem = {
  slug: string
  titleFa: string
  titleEn: string
  img: string
  model: string
  type: string
  tagsFa: string[]
  tagsEn: string[]
  likes: number
  saves: number
  views: number
}

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K'
  return String(n)
}

export default function PromptCard({ item, locale }: { item: PromptItem; locale: Locale }) {
  return (
    <Link href={'/prompts/' + item.slug} className="block">
      <article className="card-cream glow-gold p-3 transition-transform hover:-translate-y-1">
        <div className="relative">
          <img src={item.img} alt={L(locale, item.titleFa, item.titleEn)} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
          <span className="absolute right-2 top-2 rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold text-[#171512]">
            {getPromptTypeLabel(item.type, locale)}
          </span>
          <span className="glow-soft absolute -bottom-3 right-2 grid h-10 w-10 place-items-center rounded-full border border-gold bg-[#1b1408] text-[9px] font-bold text-gold-bright">
            {item.model}
          </span>
        </div>
        <h3 className="mt-4 line-clamp-1 text-sm font-bold text-[#171512]">
          {L(locale, item.titleFa, item.titleEn)}
        </h3>
        <div className="mt-2 flex flex-wrap gap-1">
          {item.tagsFa.map((tag, i) => L(locale, tag, item.tagsEn[i] ?? tag)).map((tag) => (
            <span key={tag} className="rounded-full bg-[#e7dcc4] px-2 py-0.5 text-[10px] text-[#5c5443]">{tag}</span>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[#e2d8c2] pt-2 text-[10px] text-[#6b6353]">
          <span>{fmt(item.likes)} {L(locale, 'پسند', 'likes')}</span>
          <span>{fmt(item.saves)} {L(locale, 'ذخیره', 'saves')}</span>
          <span>{fmt(item.views)} {L(locale, 'بازدید', 'views')}</span>
        </div>
      </article>
    </Link>
  )
}
EOF

echo "✅ All pages now read from real Neon database!"