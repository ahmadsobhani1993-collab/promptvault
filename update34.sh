#!/bin/bash
set -e

cat >> src/app/globals.css << 'EOF'

@keyframes fx-float {
  0%, 100% { transform: translate3d(0, 0, 0) }
  50% { transform: translate3d(0, -18px, 0) }
}
@keyframes fx-float2 {
  0%, 100% { transform: translate3d(0, 0, 0) }
  50% { transform: translate3d(0, 16px, 0) }
}
@keyframes fx-fade-up {
  from { opacity: 0; transform: translateY(26px) }
  to { opacity: 1; transform: translateY(0) }
}
@keyframes fx-shine {
  0% { background-position: 200% center }
  100% { background-position: -200% center }
}
.fx-blob {
  position: absolute;
  border-radius: 9999px;
  filter: blur(90px);
  opacity: 0.22;
  background: radial-gradient(circle, #d4a94e 0%, transparent 60%);
  will-change: transform;
}
.anim-float { animation: fx-float 7s ease-in-out infinite; }
.anim-float2 { animation: fx-float2 9s ease-in-out infinite; }
.anim-fade-up { animation: fx-fade-up 0.9s cubic-bezier(0.2, 0.7, 0.3, 1) both; }
.title-shine {
  background: linear-gradient(90deg, #f0d491 0%, #b98a2e 25%, #f7e6b6 50%, #b98a2e 75%, #f0d491 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: fx-shine 6s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .anim-float, .anim-float2, .anim-fade-up, .title-shine { animation: none }
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
    <article className="card-cream glow-gold p-3 transition-transform hover:-translate-y-1">
      <Link href={'/prompts/' + item.slug} className="block">
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
      </Link>

      <div className="mt-2 flex flex-wrap gap-1">
        {item.tagsFa.map((tag, i) => L(locale, tag, item.tagsEn[i] ?? tag)).map((tag) => (
          <Link
            key={tag}
            href={'/explore?q=' + encodeURIComponent(tag)}
            className="rounded-full bg-[#e7dcc4] px-2 py-0.5 text-[10px] text-[#5c5443] transition-colors hover:bg-gold hover:text-[#171512]"
          >
            {tag}
          </Link>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#e2d8c2] pt-2 text-[10px] text-[#6b6353]">
        <span>{fmt(item.likes)} {L(locale, 'پسند', 'likes')}</span>
        <span>{fmt(item.saves)} {L(locale, 'ذخیره', 'saves')}</span>
        <span>{fmt(item.views)} {L(locale, 'بازدید', 'views')}</span>
      </div>
    </article>
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
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import PromptCard from '@/components/prompt-card'
import CopyButton from '@/components/copy-button'
import RealLikeButton from '@/components/real-like-button'
import SaveButton from '@/components/save-button'
import RealCommentBox from '@/components/real-comment-box'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const item = await getPromptBySlug(slug)
  if (!item) return {}
  return {
    title: item.titleFa,
    description: (item.descFa ?? item.prompt).slice(0, 150),
    openGraph: {
      title: item.titleFa,
      description: item.descFa ?? '',
      images: [{ url: item.img }],
      locale: 'fa_IR',
    },
    twitter: { card: 'summary_large_image', title: item.titleFa, description: item.descFa ?? '' },
  }
}

export const dynamic = 'force-dynamic'

export default async function PromptDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const session = await auth()

  // شمارش بازدید
  await prisma.prompt.updateMany({ where: { slug }, data: { views: { increment: 1 } } })

  const item = await getPromptBySlug(slug)
  if (!item) notFound()

  const related = await getRelatedPrompts(item.categoryId, slug)

  const userId = session?.user?.id
  let liked = false
  let saved = false
  if (userId) {
    liked = !!(await prisma.like.findUnique({ where: { userId_promptId: { userId, promptId: item.id } } }))
    saved = !!(await prisma.save.findUnique({ where: { userId_promptId: { userId, promptId: item.id } } }))
  }

  const comments = await prisma.comment.findMany({
    where: { promptId: item.id },
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  })

  const desc = L(locale, item.descFa ?? '', item.descEn ?? '')
  const usage = L(locale, item.usageFa ?? '', item.usageEn ?? '')

  return (
    <section className="container-app py-16">
      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <img src={item.img} alt={L(locale, item.titleFa, item.titleEn)} className="glow-gold w-full rounded-2xl object-cover" />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={'/categories/' + item.category.slug} className="gold-badge transition-colors hover:bg-gold/25">
              {L(locale, item.category.nameFa, item.category.nameEn)}
            </Link>
            <span className="badge">{getPromptTypeLabel(item.type, locale)}</span>
            <span className="badge">{item.model}</span>
          </div>

          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">
            {L(locale, item.titleFa, item.titleEn)}
          </h1>

          {desc && <p className="mt-4 text-sm leading-7 text-ink-muted">{desc}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <RealLikeButton promptId={item.id} initialLiked={liked} initialCount={item.likes} label={L(locale, 'پسند', 'likes')} requireLogin={L(locale, 'برای لایک کردن ابتدا وارد شو', 'Login to like')} />
            <SaveButton promptId={item.id} initialSaved={saved} initialCount={item.saves} label={L(locale, 'ذخیره', 'saves')} requireLogin={L(locale, 'برای ذخیره کردن ابتدا وارد شو', 'Login to save')} />
          </div>

          <div className="mt-5 flex flex-wrap gap-1">
            {item.tagsFa.map((tag, i) => L(locale, tag, item.tagsEn[i] ?? tag)).map((tag) => (
              <Link
                key={tag}
                href={'/explore?q=' + encodeURIComponent(tag)}
                className="badge transition-colors hover:border-gold/60 hover:text-gold-bright"
              >
                {tag}
              </Link>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-gold/40 bg-[#0d0b07] p-5">
            <p className="text-xs font-bold text-gold-bright">Prompt</p>
            <p dir="ltr" className="mt-3 text-left font-mono text-sm leading-7 text-[#e8d9ae]">{item.prompt}</p>
            <div className="mt-5">
              <CopyButton text={item.prompt} label={L(locale, 'کپی پرامپت', 'Copy Prompt')} copiedLabel={L(locale, 'کپی شد!', 'Copied!')} />
            </div>
          </div>

          {usage && (
            <div className="mt-6 rounded-2xl border border-line bg-elevated p-5">
              <p className="text-xs font-bold text-gold-bright">
                {L(locale, '📘 راهنمای استفاده', '📘 How to use')}
              </p>
              <p className="mt-3 text-sm leading-7 text-ink-muted">{usage}</p>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-20">
          <h2 className="font-display text-xl font-bold tracking-tight">{L(locale, 'پرامپت‌های مشابه', 'Related prompts')}</h2>
          <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3">
            {related.map((r) => (
              <PromptCard key={r.id} item={r} locale={locale} />
            ))}
          </div>
        </div>
      )}

      <RealCommentBox
        initial={comments.map((c) => ({ id: c.id, name: c.user?.name ?? c.name, image: c.user?.image ?? null, text: c.text, createdAt: new Date(c.createdAt).toLocaleString('fa-IR') }))}
        targetId={item.id}
        targetType="prompt"
        titleLabel={L(locale, 'دیدگاه‌ها', 'Comments')}
        textPlaceholder={L(locale, 'دیدگاهت را بنویس...', 'Write your comment...')}
        submitLabel={L(locale, 'ارسال دیدگاه', 'Submit')}
        loginRequired={L(locale, 'برای ارسال دیدگاه ابتدا وارد شو', 'Login to comment')}
        isLoggedIn={!!userId}
      />
    </section>
  )
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
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
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
        <section data-section className="snap-section flex min-h-screen flex-col justify-center py-16">
          <div className="container-app">
            <Reveal>
              <h2 className="title-shine text-center font-display text-2xl font-bold tracking-tight md:text-3xl">
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
        <section data-section className="snap-section flex min-h-screen flex-col justify-center border-t border-line/60 py-16">
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

echo "✅ Clickable tags/categories + view counter + smooth animations!"