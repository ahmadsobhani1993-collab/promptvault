#!/bin/bash
set -e

cat > src/components/mouse-trail.tsx << 'EOF'
'use client'

import { useEffect, useRef } from 'react'

export default function MouseTrail() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let last = 0

    const onMove = (e: MouseEvent) => {
      const now = performance.now()
      if (now - last < 45) return
      last = now

      const star = document.createElement('span')
      star.className = 'trail-star'
      star.textContent = '✦'
      star.style.fontSize = 8 + Math.random() * 8 + 'px'
      star.style.left = e.clientX + 'px'
      star.style.top = e.clientY + 'px'
      star.style.setProperty('--dx', Math.random() * 44 - 22 + 'px')
      star.style.setProperty('--dy', -12 - Math.random() * 30 + 'px')

      el.appendChild(star)
      setTimeout(() => star.remove(), 800)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed inset-0 z-[70] overflow-hidden"
    />
  )
}
EOF

cat > src/components/reveal.tsx << 'EOF'
'use client'

import { useEffect, useRef, useState } from 'react'

export default function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            setShow(true)
            io.disconnect()
          }
        })
      },
      { threshold: 0.15 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={
        className +
        ' transition-all duration-700 ease-out ' +
        (show ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0')
      }
      style={{ transitionDelay: delay + 'ms' }}
    >
      {children}
    </div>
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
          (focused ? 'opacity-40' : 'opacity-20')
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

.trail-star {
  position: absolute;
  color: #E8C877;
  text-shadow:
    0 0 6px rgba(232, 200, 119, 0.9),
    0 0 14px rgba(201, 162, 75, 0.5);
  pointer-events: none;
  user-select: none;
  line-height: 1;
  animation: trail-fade 700ms ease-out forwards;
}

@keyframes trail-fade {
  from {
    opacity: 0.95;
    transform: translate(0, 0) scale(1) rotate(0deg);
  }
  to {
    opacity: 0;
    transform: translate(var(--dx), var(--dy)) scale(0.3) rotate(90deg);
  }
}
EOF

cat > src/app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import { Inter, Sora } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import ScrollProgress from '@/components/scroll-progress'
import MouseTrail from '@/components/mouse-trail'
import type { Locale } from '@/lib/i18n'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const sora = Sora({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-sora' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'),
  title: {
    default: 'PromptsFA — با هوش مصنوعی باهوش کار کن',
    template: '%s | PromptsFA',
  },
  description:
    'پلتفرم کشف، انتشار و اشتراک‌گذاری پرامپت‌های هوش مصنوعی برای تصویر، ویدیو، متن، کد و موسیقی.',
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  return (
    <html
      lang={locale}
      dir={locale === 'fa' ? 'rtl' : 'ltr'}
      className={`${inter.variable} ${sora.variable}`}
      suppressHydrationWarning
    >
      <body
        className="flex min-h-screen flex-col bg-base text-ink"
        suppressHydrationWarning
      >
        <ScrollProgress />
        <MouseTrail />
        <Header locale={locale} />
        <main className="flex-1">{children}</main>
        <Footer locale={locale} />
      </body>
    </html>
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
import Reveal from '@/components/reveal'
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
            <Reveal>
              <h2 className="text-center font-display text-2xl font-bold tracking-tight md:text-3xl">
                {t.trending}
              </h2>
            </Reveal>

            <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
              {prompts.slice(0, 5).map((item, i) => (
                <Reveal key={item.slug} delay={i * 90}>
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
                  label: L(locale, c.fa, c.en),
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
                <Reveal key={a.slug} delay={i * 120}>
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

echo "✅ Mouse star trail + reveal animations + hydration fix applied!"