#!/bin/bash
set -e

cat > src/app/globals.css << 'EOF'
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700;800&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
  --font-vazir: 'Vazirmatn', 'Inter', system-ui, sans-serif;
}

html {
  scroll-snap-type: y proximity;
}

.snap-section {
  scroll-snap-align: start;
}

body { @apply bg-base font-sans text-ink antialiased; }

::selection { @apply bg-gold/20 text-gold-bright; }

html[lang='fa'] body { font-family: var(--font-vazir); }
html[lang='fa'] .font-display { font-family: var(--font-vazir); }
html[dir='rtl'] * { letter-spacing: 0 !important; }

@layer components {
  .container-app { @apply mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8; }
  .card { @apply rounded-2xl border border-line bg-surface shadow-card; }
  .input { @apply w-full rounded-xl border border-line bg-elevated px-4 py-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-gold-deep focus:outline-none focus:ring-2 focus:ring-gold/20; }
  .btn-primary { @apply inline-flex items-center justify-center gap-2 rounded-xl border border-gold/70 bg-gold/10 px-4 py-2.5 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 disabled:pointer-events-none disabled:opacity-50; }
  .btn-secondary { @apply inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:pointer-events-none disabled:opacity-50; }
  .badge { @apply inline-flex items-center rounded-full border border-line bg-elevated px-2.5 py-1 text-xs text-ink-muted; }
  .gold-badge { @apply inline-flex items-center rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs text-gold-bright; }
}

.title-solid {
  color: #F7F1E3;
  text-shadow: 0 2px 24px rgba(0, 0, 0, 0.55), 0 0 46px rgba(201, 162, 75, 0.12);
}

.glow-gold {
  box-shadow:
    0 0 0 2px rgba(201, 162, 75, 0.55),
    0 0 26px rgba(201, 162, 75, 0.35);
}

.glow-soft { box-shadow: 0 0 12px rgba(201, 162, 75, 0.25); }

.hero-radial {
  background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201, 162, 75, 0.14), transparent 60%);
}

.card-cream { border-radius: 1rem; background: #F2EAD8; }

@keyframes kenburns {
  from { transform: scale(1) translateY(0); }
  to { transform: scale(1.18) translateY(-2%); }
}

.animate-kenburns {
  animation: kenburns 14s ease-in-out infinite alternate;
}
EOF

cat > src/components/zoom-section.tsx << 'EOF'
'use client'

import { useEffect, useRef } from 'react'

export default function ZoomSection({
  children,
}: {
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const inner = el.firstElementChild as HTMLElement | null
        if (!inner) return
        const rect = el.getBoundingClientRect()
        const vh = window.innerHeight
        const center = rect.top + rect.height / 2
        const p = (vh / 2 - center) / vh

        if (p >= 0) {
          const k = Math.min(p * 1.4, 1)
          inner.style.transform = 'scale(' + (1 - 0.18 * k).toFixed(3) + ')'
          inner.style.opacity = String(Math.max(1 - k * 1.1, 0))
        } else {
          const k = Math.min(-p * 1.4, 1)
          inner.style.transform = 'scale(' + (1 - 0.12 * k).toFixed(3) + ')'
          inner.style.opacity = String(Math.max(1 - k * 0.9, 0.1))
        }
      })
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={ref}>
      <div className="will-change-transform" style={{ transformOrigin: 'center center' }}>
        {children}
      </div>
    </div>
  )
}
EOF

cat > src/components/down-button.tsx << 'EOF'
'use client'

export default function DownButton() {
  const onClick = () => {
    const sections = Array.from(
      document.querySelectorAll('[data-section]')
    ) as HTMLElement[]
    const y = window.scrollY
    const next = sections.find(
      (s) => s.offsetTop > y + window.innerHeight * 0.4
    )
    if (next) {
      next.scrollIntoView({ behavior: 'smooth' })
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Next section"
      className="glow-soft fixed bottom-6 left-1/2 z-40 grid h-11 w-11 -translate-x-1/2 place-items-center rounded-full border border-gold/60 bg-[#141008]/80 text-gold-bright backdrop-blur transition-colors hover:bg-[#1d1608]"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  )
}
EOF

cat > src/components/hero.tsx << 'EOF'
'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n'

type Chip = { fa: string; en: string; href: string }

export default function Hero({
  locale,
  label,
  title,
  subtitle,
  placeholder,
  chips,
}: {
  locale: Locale
  label: string
  title: string
  subtitle: string
  placeholder: string
  chips: Chip[]
}) {
  const [focused, setFocused] = useState(false)

  return (
    <section
      data-section
      className="hero-radial snap-section relative flex min-h-[92vh] items-center overflow-hidden border-b border-line/60"
    >
      <div
        className={
          'absolute inset-0 transition-opacity duration-700 ' +
          (focused ? 'opacity-30' : 'opacity-0')
        }
      >
        <img
          src="https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1600&auto=format&fit=crop"
          alt=""
          className="animate-kenburns h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-base/60 via-base/30 to-base" />
      </div>

      <div className="container-app relative py-16 text-center">
        <p
          className={
            'text-xs font-semibold uppercase text-gold-bright ' +
            (locale === 'fa' ? '' : 'tracking-[0.35em]')
          }
        >
          {label}
        </p>

        <h1 className="title-solid mt-5 font-display text-4xl font-extrabold tracking-tight md:text-6xl">
          {title}
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-ink-muted md:text-base">
          {subtitle}
        </p>

        <form action="/explore" className="mx-auto mt-9 max-w-2xl">
          <input
            name="q"
            placeholder={placeholder}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="glow-gold h-14 w-full rounded-full border border-gold/60 bg-[#F7F1E3] px-6 text-base text-[#171512] placeholder:text-[#8a8271] focus:outline-none"
          />
        </form>

        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {chips.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="glow-soft rounded-full border border-gold/70 bg-[#141008] px-4 py-1.5 text-xs text-[#F2EAD8] transition-colors hover:bg-[#1d1608]"
            >
              {c[locale]}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
EOF

cat > src/components/category-grid.tsx << 'EOF'
'use client'

import { useState } from 'react'
import Link from 'next/link'
import CategoryIcon from '@/components/category-icon'

export default function CategoryGrid({
  items,
}: {
  items: { slug: string; icon: string; label: string }[]
}) {
  const [hover, setHover] = useState<number | null>(null)

  return (
    <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((c, i) => (
        <Link
          key={c.slug}
          href={'/categories/' + c.slug}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          className={
            'flex flex-col items-center gap-3 rounded-2xl bg-[#F2EAD8] py-7 text-[#171512] transition-all duration-300 ' +
            (hover === i
              ? 'z-10 scale-110 glow-gold'
              : hover !== null
                ? 'scale-90 opacity-70'
                : 'glow-gold')
          }
        >
          <CategoryIcon name={c.icon} />
          <span className="text-sm font-bold">{c.label}</span>
        </Link>
      ))}
    </div>
  )
}
EOF

cat > src/components/like-button.tsx << 'EOF'
'use client'

import { useState } from 'react'

export default function LikeButton({
  initial,
  label,
}: {
  initial: number
  label: string
}) {
  const [liked, setLiked] = useState(false)

  return (
    <button
      type="button"
      onClick={() => setLiked(!liked)}
      className={liked ? 'btn-primary' : 'btn-secondary'}
    >
      <svg
        viewBox="0 0 24 24"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />
      </svg>
      {initial + (liked ? 1 : 0)} {label}
    </button>
  )
}
EOF

cat > src/components/comment-box.tsx << 'EOF'
'use client'

import { useState } from 'react'

type Comment = { name: string; text: string }

export default function CommentBox({
  initial,
  titleLabel,
  namePlaceholder,
  textPlaceholder,
  submitLabel,
}: {
  initial: Comment[]
  titleLabel: string
  namePlaceholder: string
  textPlaceholder: string
  submitLabel: string
}) {
  const [list, setList] = useState<Comment[]>(initial)
  const [name, setName] = useState('')
  const [text, setText] = useState('')

  return (
    <div className="card mt-10 p-6">
      <h3 className="font-display text-lg font-bold">{titleLabel}</h3>

      <div className="mt-5 space-y-4">
        {list.map((c, i) => (
          <div key={c.name + i} className="rounded-xl border border-line bg-elevated p-4">
            <p className="text-xs font-bold text-gold-bright">{c.name}</p>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{c.text}</p>
          </div>
        ))}
      </div>

      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          setList([...list, { name: name.trim() || 'مهمان', text: text.trim() }])
          setText('')
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={namePlaceholder}
          className="input"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={textPlaceholder}
          rows={3}
          className="input resize-none"
        />
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
      </form>
    </div>
  )
}
EOF

cat > src/components/layout/header.tsx << 'EOF'
import Link from 'next/link'
import { auth, signOut } from '@/auth'
import { dictionaries, type Locale } from '@/lib/i18n'
import { categories, L } from '@/lib/data'
import { LanguageToggle } from '@/components/locale-provider'
import CategoryIcon from '@/components/category-icon'

export default async function Header({ locale }: { locale: Locale }) {
  const t = dictionaries[locale]
  const session = await auth()

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-base/80 backdrop-blur-md">
      <div className="container-app flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-display text-lg font-extrabold tracking-tight">
            Prompts<span className="text-gold-bright">FA</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/explore" className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
              {t.nav.explore}
            </Link>
            <Link href="/prompts" className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
              {t.nav.prompts}
            </Link>

            <div className="group relative">
              <Link href="/categories" className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
                {t.nav.categories}
              </Link>

              <div className="absolute end-0 top-full z-50 hidden w-80 pt-3 group-hover:block">
                <div className="card grid grid-cols-2 gap-2 p-3">
                  {categories.map((c) => (
                    <Link
                      key={c.slug}
                      href={'/categories/' + c.slug}
                      className="rounded-xl border border-line bg-elevated p-3 transition-colors hover:border-gold/50 hover:bg-surface-hover"
                    >
                      <div className="text-gold-bright [&_svg]:h-5 [&_svg]:w-5">
                        <CategoryIcon name={c.icon} />
                      </div>
                      <p className="mt-2 text-xs font-bold text-ink">
                        {L(locale, c.fa, c.en)}
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-ink-faint">
                        {c.subs.map((s) => L(locale, s.fa, s.en)).join('، ')}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <Link href="/creators" className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
              {t.nav.creators}
            </Link>
            <Link href="/blog" className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
              {t.nav.blog}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/submit" className="btn-secondary hidden md:inline-flex">
            {t.submit}
          </Link>

          <LanguageToggle locale={locale} label={t.langToggle} />

          {session?.user ? (
            <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }) }}>
              <button type="submit" className="btn-secondary">{t.logout}</button>
            </form>
          ) : (
            <Link href="/login" className="btn-primary">{t.login}</Link>
          )}
        </div>
      </div>
    </header>
  )
}
EOF

cat > src/app/page.tsx << 'EOF'
import { cookies } from 'next/headers'
import { dictionaries, type Locale } from '@/lib/i18n'
import { categories, prompts, articles, L } from '@/lib/data'
import PromptCard from '@/components/prompt-card'
import Hero from '@/components/hero'
import ZoomSection from '@/components/zoom-section'
import DownButton from '@/components/down-button'
import CategoryGrid from '@/components/category-grid'
import Link from 'next/link'

const chips = [
  { fa: 'داغ‌ترین', en: 'Trending', href: '/explore?sort=trending' },
  { fa: 'جدید', en: 'New', href: '/explore?sort=newest' },
  { fa: 'تصویر', en: 'Image', href: '/explore?type=image' },
  { fa: 'ویدیو', en: 'Video', href: '/explore?type=video' },
  { fa: 'متن', en: 'Text', href: '/explore?type=text' },
  { fa: 'کد', en: 'Code', href: '/explore?type=code' },
  { fa: 'موسیقی', en: 'Music', href: '/explore?type=audio' },
  { fa: 'بهره‌وری', en: 'Productivity', href: '/explore?type=productivity' },
]

export default async function HomePage() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const t = dictionaries[locale]

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
            <h2 className="text-center font-display text-2xl font-bold tracking-tight md:text-3xl">
              {t.trending}
            </h2>

            <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
              {prompts.slice(0, 5).map((item, i) => (
                <div key={item.slug} className="animate-slide-up" style={{ animationDelay: i * 90 + 'ms' }}>
                  <PromptCard item={item} locale={locale} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </ZoomSection>

      <ZoomSection>
        <section data-section className="snap-section flex min-h-screen flex-col justify-center border-t border-line/60 py-16">
          <div className="container-app">
            <h2 className="text-center font-display text-2xl font-bold tracking-tight md:text-3xl">
              {t.categoriesTitle}
            </h2>

            <CategoryGrid
              items={categories.map((c) => ({
                slug: c.slug,
                icon: c.icon,
                label: L(locale, c.fa, c.en),
              }))}
            />
          </div>
        </section>
      </ZoomSection>

      <ZoomSection>
        <section data-section className="snap-section flex min-h-screen flex-col justify-center border-t border-line/60 py-16">
          <div className="container-app">
            <div className="flex items-end justify-between gap-6">
              <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                {t.blogSection}
              </h2>
              <Link href="/blog" className="text-sm text-gold-bright hover:text-gold">
                {L(locale, 'همه مقالات', 'All articles')}
              </Link>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {articles.map((a, i) => (
                <div key={a.slug} className="animate-slide-up" style={{ animationDelay: i * 120 + 'ms' }}>
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
                </div>
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

cat > 'src/app/blog/[slug]/page.tsx' << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { type Locale } from '@/lib/i18n'
import { articles, prompts, L } from '@/lib/data'
import PromptCard from '@/components/prompt-card'
import LikeButton from '@/components/like-button'
import CommentBox from '@/components/comment-box'

const relatedMap: Record<string, string[]> = {
  'midjourney-starter': ['cinematic-portrait-rain', 'luxury-product-shot', 'vibrant-studio-portrait'],
  'better-prompts': ['ad-copywriting', 'content-assistant', 'dark-fantasy-character'],
  'flux-vs-sd': ['luxury-product-shot', 'dark-fantasy-character', 'futuristic-architecture'],
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const a = articles.find((x) => x.slug === slug)
  if (!a) return {}
  return { title: a.titleFa, description: a.descFa }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const a = articles.find((x) => x.slug === slug)
  if (!a) notFound()

  const content = locale === 'fa' ? a.contentFa : a.contentEn
  const others = articles.filter((x) => x.slug !== slug)
  const relatedSlugs = relatedMap[slug] ?? []
  const related = prompts.filter((p) => relatedSlugs.includes(p.slug))

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

      <img
        src={a.img}
        alt={L(locale, a.titleFa, a.titleEn)}
        className="glow-gold mt-8 w-full rounded-2xl object-cover"
      />

      <div className="mt-8 space-y-6">
        {content.map((p) => (
          <p key={p.slice(0, 20)} className="text-base leading-8 text-ink-muted">
            {p}
          </p>
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
              <PromptCard key={r.slug} item={r} locale={locale} />
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
            <Link key={o.slug} href={'/blog/' + o.slug} className="card flex items-center gap-4 p-4 transition-colors hover:border-line-strong">
              <img src={o.img} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <div>
                <p className="line-clamp-1 text-sm font-bold text-ink">
                  {L(locale, o.titleFa, o.titleEn)}
                </p>
                <p className="mt-1 text-[10px] text-ink-faint">
                  {L(locale, o.readFa, o.readEn)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <CommentBox
        initial={[
          { name: 'سارا', text: L(locale, 'عالی بود، دقیقاً چیزی که نیاز داشتم!', 'Great, exactly what I needed!') },
          { name: 'Ali', text: L(locale, 'نکات خیلی کاربردی بودند.', 'Very practical tips.') },
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

echo "✅ Zoom sections + hover categories + animated search + blog interactions applied!"