#!/bin/bash
set -e

cat > src/lib/i18n.ts << 'EOF'
export type Locale = 'fa' | 'en'

export interface Dict {
  nav: {
    explore: string
    prompts: string
    categories: string
    creators: string
    collections: string
  }
  submit: string
  login: string
  logout: string
  heroLabel: string
  heroTitle: string
  heroSubtitle: string
  searchPlaceholder: string
  trending: string
  categoriesTitle: string
  likes: string
  saves: string
  views: string
  footerTagline: string
  rights: string
  langToggle: string
  typeImage: string
}

export const dictionaries: Record<Locale, Dict> = {
  en: {
    nav: {
      explore: 'Explore',
      prompts: 'Prompts',
      categories: 'Categories',
      creators: 'Creators',
      collections: 'Collections',
    },
    submit: 'Submit Prompt',
    login: 'Login',
    logout: 'Sign out',
    heroLabel: 'Prompt Discovery Platform',
    heroTitle: 'CREATE. DISCOVER. SHARE.',
    heroSubtitle:
      'Discover premium AI prompts for image, video, text, code, music, and productivity.',
    searchPlaceholder: 'Search thousands of AI prompts...',
    trending: 'Trending Prompts',
    categoriesTitle: 'Explore Categories',
    likes: 'likes',
    saves: 'saves',
    views: 'views',
    footerTagline: 'Beautiful but fast.',
    rights: 'All rights reserved.',
    langToggle: 'فارسی',
    typeImage: 'Image',
  },
  fa: {
    nav: {
      explore: 'کاوش',
      prompts: 'پرامپت‌ها',
      categories: 'دسته‌بندی‌ها',
      creators: 'سازندگان',
      collections: 'مجموعه‌ها',
    },
    submit: 'ارسال پرامپت',
    login: 'ورود',
    logout: 'خروج',
    heroLabel: 'پلتفرم کشف پرامپت هوش مصنوعی',
    heroTitle: 'بساز. کشف کن. به اشتراک بگذار.',
    heroSubtitle:
      'هزاران پرامپت حرفه‌ای هوش مصنوعی برای تصویر، ویدیو، متن، کد، موسیقی و بهره‌وری کشف کن.',
    searchPlaceholder: 'جستجو در هزاران پرامپت هوش مصنوعی...',
    trending: 'پرامپت‌های داغ',
    categoriesTitle: 'دسته‌بندی‌ها',
    likes: 'پسند',
    saves: 'ذخیره',
    views: 'بازدید',
    footerTagline: 'زیبا اما سریع.',
    rights: 'تمامی حقوق محفوظ است.',
    langToggle: 'English',
    typeImage: 'تصویر',
  },
}
EOF

cat > src/lib/locale-action.ts << 'EOF'
'use server'

import { cookies } from 'next/headers'

export async function setLocaleCookie(locale: string) {
  const cookieStore = await cookies()
  cookieStore.set('locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
}
EOF

cat > src/components/locale-provider.tsx << 'EOF'
'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { setLocaleCookie } from '@/lib/locale-action'
import type { Locale } from '@/lib/i18n'

export function LanguageToggle({
  locale,
  label,
}: {
  locale: Locale
  label: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const next: Locale = locale === 'fa' ? 'en' : 'fa'

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setLocaleCookie(next)
          router.refresh()
        })
      }
      className="btn-secondary px-3 py-1.5 text-xs"
    >
      {label}
    </button>
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

.glow-text {
  text-shadow:
    0 0 16px rgba(247, 241, 227, 0.35),
    0 0 34px rgba(232, 200, 119, 0.55),
    0 0 80px rgba(201, 162, 75, 0.35);
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
EOF

cat > src/app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import { Inter, Sora } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import type { Locale } from '@/lib/i18n'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const sora = Sora({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-sora' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'),
  title: {
    default: 'PromptsFA — کشف و اشتراک پرامپت‌های هوش مصنوعی',
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
    >
      <body className="flex min-h-screen flex-col bg-base text-ink">
        <Header locale={locale} />
        <main className="flex-1">{children}</main>
        <Footer locale={locale} />
      </body>
    </html>
  )
}
EOF

cat > src/components/layout/header.tsx << 'EOF'
import Link from 'next/link'
import { auth, signOut } from '@/auth'
import { dictionaries, type Locale } from '@/lib/i18n'
import { LanguageToggle } from '@/components/locale-provider'

export default async function Header({ locale }: { locale: Locale }) {
  const t = dictionaries[locale]
  const session = await auth()

  const navItems = [
    { href: '/explore', label: t.nav.explore },
    { href: '/prompts', label: t.nav.prompts },
    { href: '/categories', label: t.nav.categories },
    { href: '/creators', label: t.nav.creators },
    { href: '/collections', label: t.nav.collections },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-base/80 backdrop-blur-md">
      <div className="container-app flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-display text-lg font-extrabold tracking-tight">
            Prompts<span className="text-gold-bright">FA</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-ink-muted transition-colors hover:text-gold-bright"
              >
                {item.label}
              </Link>
            ))}
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

cat > src/components/layout/footer.tsx << 'EOF'
import { dictionaries, type Locale } from '@/lib/i18n'

export default function Footer({ locale }: { locale: Locale }) {
  const t = dictionaries[locale]

  return (
    <footer className="border-t border-line/70 bg-elevated/30">
      <div className="container-app py-12">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="font-display text-lg font-extrabold">
              Prompts<span className="text-gold-bright">FA</span>
            </p>
            <p dir="ltr" className="mt-1 text-xs text-gold-bright/80 ltr:text-left rtl:text-right">
              promptsfa.ir
            </p>
          </div>
          <p className="text-xs text-ink-faint">
            © {new Date().getFullYear()} PromptsFA — {t.footerTagline} {t.rights}
          </p>
        </div>
      </div>
    </footer>
  )
}
EOF

cat > src/app/page.tsx << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { dictionaries, type Locale } from '@/lib/i18n'

const items = [
  {
    img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800&auto=format&fit=crop',
    model: 'MJ',
    likes: '248',
    saves: '1.2K',
    views: '8.7K',
    title: { fa: 'پرتره سینمایی در باران', en: 'Cinematic Portrait in Rain' },
    tags: { fa: ['پرتره', 'سینمایی'], en: ['portrait', 'cinematic'] },
  },
  {
    img: 'https://images.unsplash.com/photo-1541643600914-78b084683601?q=80&w=800&auto=format&fit=crop',
    model: 'FLUX',
    likes: '312',
    saves: '1.8K',
    views: '9.1K',
    title: { fa: 'عکاسی محصول لوکس', en: 'Luxury Product Studio Shot' },
    tags: { fa: ['محصول', 'لوکس'], en: ['product', 'luxury'] },
  },
  {
    img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=800&auto=format&fit=crop',
    model: 'SD',
    likes: '198',
    saves: '940',
    views: '8.3K',
    title: { fa: 'کاراکتر فانتزی تاریک', en: 'Dark Fantasy Character' },
    tags: { fa: ['فانتزی', 'کاراکتر'], en: ['fantasy', 'character'] },
  },
  {
    img: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=800&auto=format&fit=crop',
    model: 'MJ',
    likes: '176',
    saves: '820',
    views: '7.7K',
    title: { fa: 'معماری آینده‌نگرانه', en: 'Futuristic Architecture' },
    tags: { fa: ['معماری', 'آینده'], en: ['architecture', 'future'] },
  },
  {
    img: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?q=80&w=800&auto=format&fit=crop',
    model: 'DALL·E',
    likes: '154',
    saves: '760',
    views: '6.9K',
    title: { fa: 'پرتره استودیویی رنگارنگ', en: 'Vibrant Studio Portrait' },
    tags: { fa: ['استودیو', 'رنگ'], en: ['studio', 'color'] },
  },
]

const chips = [
  { fa: 'داغ‌ترین', en: 'Trending', href: '/explore?sort=trending' },
  { fa: 'جدید', en: 'New', href: '/explore?sort=newest' },
  { fa: 'تصویر', en: 'Image', href: '/explore?type=image' },
  { fa: 'ویدیو', en: 'Video', href: '/explore?type=video' },
  { fa: 'متن', en: 'Text', href: '/explore?type=text' },
  { fa: 'کد', en: 'Code', href: '/explore?type=code' },
  { fa: 'موسیقی', en: 'Music', href: '/explore?type=audio' },
  { fa: 'بهره‌وری', en: 'Productivity', href: '/explore?category=productivity' },
]

const cats = [
  { icon: 'camera', label: { fa: 'تصویر', en: 'Image' } },
  { icon: 'play', label: { fa: 'ویدیو', en: 'Video' } },
  { icon: 'file', label: { fa: 'متن', en: 'Text' } },
  { icon: 'code', label: { fa: 'کد', en: 'Code' } },
  { icon: 'music', label: { fa: 'موسیقی', en: 'Music' } },
  { icon: 'gear', label: { fa: 'بهره‌وری', en: 'Productivity' } },
]

function CategoryIcon({ name }: { name: string }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    viewBox: '0 0 24 24',
  }

  switch (name) {
    case 'camera':
      return (
        <svg {...common} className="h-9 w-9">
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      )
    case 'play':
      return (
        <svg {...common} className="h-9 w-9">
          <circle cx="12" cy="12" r="10" />
          <polygon points="10 8 16 12 10 16 10 8" />
        </svg>
      )
    case 'file':
      return (
        <svg {...common} className="h-9 w-9">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      )
    case 'code':
      return (
        <svg {...common} className="h-9 w-9">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      )
    case 'music':
      return (
        <svg {...common} className="h-9 w-9">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="18" r="3" />
        </svg>
      )
    default:
      return (
        <svg {...common} className="h-9 w-9">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
  }
}

export default async function HomePage() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const t = dictionaries[locale]

  return (
    <>
      <section className="hero-radial border-b border-line/60">
        <div className="container-app py-20 text-center md:py-24">
          <p className={'text-xs font-semibold uppercase text-gold-bright ' + (locale === 'fa' ? '' : 'tracking-[0.35em]')}>
            {t.heroLabel}
          </p>

          <h1 className="glow-text mt-5 font-display text-4xl font-extrabold tracking-tight text-[#F7F1E3] md:text-6xl">
            {t.heroTitle}
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-ink-muted md:text-base">
            {t.heroSubtitle}
          </p>

          <form action="/explore" className="mx-auto mt-9 max-w-2xl">
            <input
              name="q"
              placeholder={t.searchPlaceholder}
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

      <section className="container-app py-16">
        <h2 className="text-center font-display text-2xl font-bold tracking-tight md:text-3xl">
          {t.trending}
        </h2>

        <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
          {items.map((item) => (
            <article key={item.model + item.views} className="card-cream glow-gold p-3 transition-transform hover:-translate-y-1">
              <div className="relative">
                <img
                  src={item.img}
                  alt={item.title[locale]}
                  loading="lazy"
                  className="aspect-square w-full rounded-lg object-cover"
                />
                <span className="absolute right-2 top-2 rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold text-[#171512]">
                  {t.typeImage}
                </span>
                <span className="glow-soft absolute -bottom-3 right-2 grid h-10 w-10 place-items-center rounded-full border border-gold bg-[#1b1408] text-[9px] font-bold text-gold-bright">
                  {item.model}
                </span>
              </div>

              <h3 className="mt-4 line-clamp-1 text-sm font-bold text-[#171512]">
                {item.title[locale]}
              </h3>

              <div className="mt-2 flex flex-wrap gap-1">
                {item.tags[locale].map((tag) => (
                  <span key={tag} className="rounded-full bg-[#e7dcc4] px-2 py-0.5 text-[10px] text-[#5c5443]">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-[#e2d8c2] pt-2 text-[10px] text-[#6b6353]">
                <span>{item.likes} {t.likes}</span>
                <span>{item.saves} {t.saves}</span>
                <span>{item.views} {t.views}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="container-app pb-20">
        <h2 className="text-center font-display text-2xl font-bold tracking-tight md:text-3xl">
          {t.categoriesTitle}
        </h2>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {cats.map((cat) => (
            <Link
              key={cat.icon}
              href={'/explore?type=' + cat.icon}
              className="glow-gold flex flex-col items-center gap-3 rounded-2xl bg-[#F2EAD8] py-7 text-[#171512] transition-transform hover:-translate-y-1"
            >
              <CategoryIcon name={cat.icon} />
              <span className="text-sm font-bold">{cat.label[locale]}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
EOF

echo "✅ PromptsFA bilingual (fa default) + rich visual style applied!"
