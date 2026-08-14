#!/bin/bash
set -e

mkdir -p 'src/app/categories/[slug]'

cat > src/lib/data.ts << 'EOF'
import type { Locale } from '@/lib/i18n'

export const L = (locale: Locale, fa: string, en: string) =>
  locale === 'fa' ? fa : en

export type PromptType = 'image' | 'video' | 'text' | 'code' | 'audio'

export const typeLabel: Record<PromptType, { fa: string; en: string }> = {
  image: { fa: 'تصویر', en: 'Image' },
  video: { fa: 'ویدیو', en: 'Video' },
  text: { fa: 'متن', en: 'Text' },
  code: { fa: 'کد', en: 'Code' },
  audio: { fa: 'موسیقی', en: 'Music' },
}

export interface Prompt {
  slug: string
  titleFa: string
  titleEn: string
  img: string
  model: string
  type: PromptType
  category: string
  sub: string
  tagsFa: string[]
  tagsEn: string[]
  likes: string
  saves: string
  views: string
}

export interface Category {
  slug: string
  icon: string
  fa: string
  en: string
  descFa: string
  descEn: string
  subs: { slug: string; fa: string; en: string }[]
}

export const categories: Category[] = [
  {
    slug: 'image',
    icon: 'camera',
    fa: 'تصویر',
    en: 'Image',
    descFa: 'پرتره، محصول، کاراکتر و هنرهای تصویری',
    descEn: 'Portraits, product, character and visual arts',
    subs: [
      { slug: 'photography', fa: 'عکاسی', en: 'Photography' },
      { slug: 'product', fa: 'محصول', en: 'Product' },
      { slug: 'character', fa: 'کاراکتر', en: 'Character' },
    ],
  },
  {
    slug: 'video',
    icon: 'play',
    fa: 'ویدیو',
    en: 'Video',
    descFa: 'تیزر، فیلم کوتاه و موشن',
    descEn: 'Teasers, short films and motion',
    subs: [
      { slug: 'cinematic', fa: 'سینمایی', en: 'Cinematic' },
      { slug: 'shortfilm', fa: 'فیلم کوتاه', en: 'Short Film' },
    ],
  },
  {
    slug: 'text',
    icon: 'file',
    fa: 'متن',
    en: 'Text',
    descFa: 'نویسندگی، تبلیغات و تولید محتوا',
    descEn: 'Writing, ads and content creation',
    subs: [
      { slug: 'writing', fa: 'نویسندگی', en: 'Writing' },
      { slug: 'marketing', fa: 'تبلیغات', en: 'Marketing' },
    ],
  },
  {
    slug: 'code',
    icon: 'code',
    fa: 'کد',
    en: 'Code',
    descFa: 'تولید کد، دیباگ و معماری نرم‌افزار',
    descEn: 'Code generation, debugging and architecture',
    subs: [
      { slug: 'frontend', fa: 'فرانت‌اند', en: 'Frontend' },
      { slug: 'debug', fa: 'دیباگ', en: 'Debug' },
    ],
  },
  {
    slug: 'music',
    icon: 'music',
    fa: 'موسیقی',
    en: 'Music',
    descFa: 'موسیقی فیلم، امبینت و آهنگسازی',
    descEn: 'Soundtrack, ambient and composition',
    subs: [
      { slug: 'soundtrack', fa: 'موسیقی فیلم', en: 'Soundtrack' },
      { slug: 'ambient', fa: 'امبینت', en: 'Ambient' },
    ],
  },
  {
    slug: 'productivity',
    icon: 'gear',
    fa: 'بهره‌وری',
    en: 'Productivity',
    descFa: 'برنامه‌ریزی، یادگیری و مدیریت',
    descEn: 'Planning, learning and management',
    subs: [
      { slug: 'planning', fa: 'برنامه‌ریزی', en: 'Planning' },
      { slug: 'learning', fa: 'یادگیری', en: 'Learning' },
    ],
  },
]

export const prompts: Prompt[] = [
  {
    slug: 'cinematic-portrait-rain',
    titleFa: 'پرتره سینمایی در باران',
    titleEn: 'Cinematic Portrait in Rain',
    img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800&auto=format&fit=crop',
    model: 'MJ',
    type: 'image',
    category: 'image',
    sub: 'photography',
    tagsFa: ['پرتره', 'سینمایی'],
    tagsEn: ['portrait', 'cinematic'],
    likes: '248',
    saves: '1.2K',
    views: '8.7K',
  },
  {
    slug: 'luxury-product-shot',
    titleFa: 'عکاسی محصول لوکس',
    titleEn: 'Luxury Product Studio Shot',
    img: 'https://images.unsplash.com/photo-1541643600914-78b084683601?q=80&w=800&auto=format&fit=crop',
    model: 'FLUX',
    type: 'image',
    category: 'image',
    sub: 'product',
    tagsFa: ['محصول', 'لوکس'],
    tagsEn: ['product', 'luxury'],
    likes: '312',
    saves: '1.8K',
    views: '9.1K',
  },
  {
    slug: 'dark-fantasy-character',
    titleFa: 'کاراکتر فانتزی تاریک',
    titleEn: 'Dark Fantasy Character',
    img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=800&auto=format&fit=crop',
    model: 'SD',
    type: 'image',
    category: 'image',
    sub: 'character',
    tagsFa: ['فانتزی', 'کاراکتر'],
    tagsEn: ['fantasy', 'character'],
    likes: '198',
    saves: '940',
    views: '8.3K',
  },
  {
    slug: 'futuristic-architecture',
    titleFa: 'معماری آینده‌نگرانه',
    titleEn: 'Futuristic Architecture',
    img: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=800&auto=format&fit=crop',
    model: 'MJ',
    type: 'image',
    category: 'image',
    sub: 'photography',
    tagsFa: ['معماری', 'آینده'],
    tagsEn: ['architecture', 'future'],
    likes: '176',
    saves: '820',
    views: '7.7K',
  },
  {
    slug: 'vibrant-studio-portrait',
    titleFa: 'پرتره استودیویی رنگارنگ',
    titleEn: 'Vibrant Studio Portrait',
    img: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?q=80&w=800&auto=format&fit=crop',
    model: 'DALL·E',
    type: 'image',
    category: 'image',
    sub: 'photography',
    tagsFa: ['استودیو', 'رنگ'],
    tagsEn: ['studio', 'color'],
    likes: '154',
    saves: '760',
    views: '6.9K',
  },
  {
    slug: 'cinematic-product-teaser',
    titleFa: 'تیزر سینمایی محصول',
    titleEn: 'Cinematic Product Teaser',
    img: 'https://images.unsplash.com/photo-1574717024653-61fd284d5c1c?q=80&w=800&auto=format&fit=crop',
    model: 'Veo',
    type: 'video',
    category: 'video',
    sub: 'cinematic',
    tagsFa: ['تیزر', 'سینمایی'],
    tagsEn: ['teaser', 'cinematic'],
    likes: '201',
    saves: '1.1K',
    views: '7.2K',
  },
  {
    slug: 'neon-music-video',
    titleFa: 'موزیک ویدیوی نئونی',
    titleEn: 'Neon Music Video',
    img: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=800&auto=format&fit=crop',
    model: 'Runway',
    type: 'video',
    category: 'video',
    sub: 'shortfilm',
    tagsFa: ['نئون', 'موزیک'],
    tagsEn: ['neon', 'music'],
    likes: '167',
    saves: '700',
    views: '6.1K',
  },
  {
    slug: 'ad-copywriting',
    titleFa: 'کپی‌رایتینگ تبلیغاتی',
    titleEn: 'Ad Copywriting',
    img: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=800&auto=format&fit=crop',
    model: 'ChatGPT',
    type: 'text',
    category: 'text',
    sub: 'marketing',
    tagsFa: ['تبلیغات', 'نویسندگی'],
    tagsEn: ['ads', 'writing'],
    likes: '143',
    saves: '650',
    views: '5.8K',
  },
  {
    slug: 'content-assistant',
    titleFa: 'دستیار تولید محتوا',
    titleEn: 'Content Creation Assistant',
    img: 'https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?q=80&w=800&auto=format&fit=crop',
    model: 'Gemini',
    type: 'text',
    category: 'text',
    sub: 'writing',
    tagsFa: ['محتوا', 'شبکه اجتماعی'],
    tagsEn: ['content', 'social'],
    likes: '129',
    saves: '580',
    views: '5.2K',
  },
  {
    slug: 'react-component-gen',
    titleFa: 'تولید کامپوننت React',
    titleEn: 'React Component Generator',
    img: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=800&auto=format&fit=crop',
    model: 'ChatGPT',
    type: 'code',
    category: 'code',
    sub: 'frontend',
    tagsFa: ['ری‌اکت', 'کامپوننت'],
    tagsEn: ['react', 'component'],
    likes: '188',
    saves: '900',
    views: '6.6K',
  },
  {
    slug: 'smart-debug',
    titleFa: 'دیباگ هوشمند کد',
    titleEn: 'Smart Code Debugging',
    img: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=800&auto=format&fit=crop',
    model: 'Gemini',
    type: 'code',
    category: 'code',
    sub: 'debug',
    tagsFa: ['دیباگ', 'بهینه‌سازی'],
    tagsEn: ['debug', 'optimize'],
    likes: '121',
    saves: '540',
    views: '4.9K',
  },
  {
    slug: 'film-score',
    titleFa: 'موسیقی متن فیلم',
    titleEn: 'Epic Film Score',
    img: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=800&auto=format&fit=crop',
    model: 'Suno',
    type: 'audio',
    category: 'music',
    sub: 'soundtrack',
    tagsFa: ['موسیقی فیلم', 'حماسی'],
    tagsEn: ['score', 'epic'],
    likes: '134',
    saves: '610',
    views: '5.4K',
  },
  {
    slug: 'week-planner',
    titleFa: 'برنامه‌ریزی هفته با AI',
    titleEn: 'AI Weekly Planner',
    img: 'https://images.unsplash.com/photo-1484480974693-6ca0b78fb3e6?q=80&w=800&auto=format&fit=crop',
    model: 'ChatGPT',
    type: 'text',
    category: 'productivity',
    sub: 'planning',
    tagsFa: ['برنامه‌ریزی', 'تمرکز'],
    tagsEn: ['planning', 'focus'],
    likes: '110',
    saves: '480',
    views: '4.4K',
  },
]
EOF

cat > src/components/category-icon.tsx << 'EOF'
export default function CategoryIcon({ name }: { name: string }) {
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
EOF

cat > src/components/prompt-card.tsx << 'EOF'
import type { Locale } from '@/lib/i18n'
import { L, typeLabel, type Prompt } from '@/lib/data'

export default function PromptCard({
  item,
  locale,
}: {
  item: Prompt
  locale: Locale
}) {
  return (
    <article className="card-cream glow-gold p-3 transition-transform hover:-translate-y-1">
      <div className="relative">
        <img
          src={item.img}
          alt={L(locale, item.titleFa, item.titleEn)}
          loading="lazy"
          className="aspect-square w-full rounded-lg object-cover"
        />
        <span className="absolute right-2 top-2 rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold text-[#171512]">
          {L(locale, typeLabel[item.type].fa, typeLabel[item.type].en)}
        </span>
        <span className="glow-soft absolute -bottom-3 right-2 grid h-10 w-10 place-items-center rounded-full border border-gold bg-[#1b1408] text-[9px] font-bold text-gold-bright">
          {item.model}
        </span>
      </div>

      <h3 className="mt-4 line-clamp-1 text-sm font-bold text-[#171512]">
        {L(locale, item.titleFa, item.titleEn)}
      </h3>

      <div className="mt-2 flex flex-wrap gap-1">
        {L(locale, item.tagsFa.join('§'), item.tagsEn.join('§'))
          .split('§')
          .map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[#e7dcc4] px-2 py-0.5 text-[10px] text-[#5c5443]"
            >
              {tag}
            </span>
          ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#e2d8c2] pt-2 text-[10px] text-[#6b6353]">
        <span>{item.likes} {L(locale, 'پسند', 'likes')}</span>
        <span>{item.saves} {L(locale, 'ذخیره', 'saves')}</span>
        <span>{item.views} {L(locale, 'بازدید', 'views')}</span>
      </div>
    </article>
  )
}
EOF

cat > src/components/scroll-progress.tsx << 'EOF'
'use client'

import { useEffect, useState } from 'react'

export default function ScrollProgress() {
  const [p, setP] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement
      const max = h.scrollHeight - h.clientHeight
      setP(max > 0 ? h.scrollTop / max : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className="fixed left-0 top-0 z-[60] h-0.5 bg-gold shadow-gold-glow"
      style={{ width: (p * 100).toFixed(2) + '%' }}
    />
  )
}
EOF

cat > src/components/scroll-story.tsx << 'EOF'
'use client'

import { useEffect, useRef } from 'react'

export interface StorySection {
  img: string
  title: string
  subtitle: string
}

export default function ScrollStory({ sections }: { sections: StorySection[] }) {
  const refs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    let raf = 0

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const vh = window.innerHeight
        refs.current.forEach((el) => {
          if (!el) return
          const img = el.querySelector('img')
          const content = el.querySelector('[data-content]') as HTMLElement | null
          const rect = el.getBoundingClientRect()
          const progress = Math.min(Math.max((vh - rect.top) / (vh + rect.height), 0), 1)
          const scale = 1.18 - progress * 0.18
          const opacity = Math.min(Math.max((vh - rect.top) / vh, 0), 1)
          if (img) img.style.transform = 'scale(' + scale.toFixed(3) + ')'
          if (content) content.style.opacity = Math.min(1, opacity * 1.3).toFixed(2)
        })
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
    <div>
      {sections.map((s, i) => (
        <div
          key={s.title}
          ref={(el) => {
            refs.current[i] = el
          }}
          className="relative flex h-[80vh] items-center justify-center overflow-hidden"
        >
          <img
            src={s.img}
            alt={s.title}
            className="absolute inset-0 h-full w-full object-cover opacity-40 will-change-transform"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-base via-base/40 to-base" />
          <div data-content className="relative z-10 px-6 text-center">
            <h2 className="glow-text font-display text-3xl font-extrabold md:text-5xl">
              {s.title}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-ink-muted md:text-base">
              {s.subtitle}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
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
    >
      <body className="flex min-h-screen flex-col bg-base text-ink">
        <ScrollProgress />
        <Header locale={locale} />
        <main className="flex-1">{children}</main>
        <Footer locale={locale} />
      </body>
    </html>
  )
}
EOF

cat > src/app/page.tsx << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { dictionaries, type Locale } from '@/lib/i18n'
import { categories, prompts, L } from '@/lib/data'
import PromptCard from '@/components/prompt-card'
import CategoryIcon from '@/components/category-icon'
import ScrollStory from '@/components/scroll-story'

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

  const story = [
    {
      img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1600&auto=format&fit=crop',
      title: L(locale, 'کشف کن', 'Discover'),
      subtitle: L(
        locale,
        'هزاران پرامپت واقعی با تصویر، مدل و جزئیات کامل — مثل یک گالری زنده از بهترین‌ها.',
        'Thousands of real prompts with images, models and full details — a living gallery of the best.'
      ),
    },
    {
      img: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1600&auto=format&fit=crop',
      title: L(locale, 'بساز', 'Create'),
      subtitle: L(
        locale,
        'از پرامپت‌های برتر ایده بگیر و خروجی‌های حرفه‌ای بسازی؛ تصویر، ویدیو، کد و موسیقی.',
        'Learn from top prompts and build professional output: image, video, code and music.'
      ),
    },
    {
      img: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1600&auto=format&fit=crop',
      title: L(locale, 'به اشتراک بگذار', 'Share'),
      subtitle: L(
        locale,
        'اثر خودت را منتشر کن، بازخورد بگیر و در جامعه سازندگان دیده شو.',
        'Publish your work, get feedback, and get seen in the creator community.'
      ),
    },
  ]

  return (
    <>
      <section className="hero-radial border-b border-line/60">
        <div className="container-app py-20 text-center md:py-24">
          <p className={'text-xs font-semibold uppercase text-gold-bright ' + (locale === 'fa' ? '' : 'tracking-[0.35em]')}>
            {t.heroLabel}
          </p>

          <h1 className="glow-text mt-5 font-display text-4xl font-extrabold tracking-tight text-[#F7F1E3] md:text-6xl">
            {L(locale, 'با هوش مصنوعی باهوش کار کن.', 'Work smart with AI.')}
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

      <ScrollStory sections={story} />

      <section className="container-app py-16">
        <h2 className="text-center font-display text-2xl font-bold tracking-tight md:text-3xl">
          {t.trending}
        </h2>

        <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
          {prompts.slice(0, 5).map((item) => (
            <PromptCard key={item.slug} item={item} locale={locale} />
          ))}
        </div>
      </section>

      <section className="container-app pb-20">
        <h2 className="text-center font-display text-2xl font-bold tracking-tight md:text-3xl">
          {t.categoriesTitle}
        </h2>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={'/categories/' + cat.slug}
              className="glow-gold flex flex-col items-center gap-3 rounded-2xl bg-[#F2EAD8] py-7 text-[#171512] transition-transform hover:-translate-y-1"
            >
              <CategoryIcon name={cat.icon} />
              <span className="text-sm font-bold">{L(locale, cat.fa, cat.en)}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
EOF

cat > src/app/categories/page.tsx << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { dictionaries, type Locale } from '@/lib/i18n'
import { categories, L } from '@/lib/data'
import CategoryIcon from '@/components/category-icon'

export const metadata = {
  title: 'دسته‌بندی‌ها',
  description: 'دسته‌بندی پرامپت‌های هوش مصنوعی',
}

export default async function CategoriesPage() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const t = dictionaries[locale]

  return (
    <section className="container-app py-16">
      <h1 className="text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        {t.categoriesTitle}
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-7 text-ink-muted">
        {L(
          locale,
          'هر دسته شامل زیرشاخه‌ها و پرامپت‌های مرتبط است. روی هر دسته بزن تا وارد شوی.',
          'Each category contains subcategories and related prompts. Click to enter.'
        )}
      </p>

      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={'/categories/' + cat.slug}
            className="card-cream glow-gold flex items-start gap-5 p-6 transition-transform hover:-translate-y-1"
          >
            <div className="text-[#171512]">
              <CategoryIcon name={cat.icon} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#171512]">
                {L(locale, cat.fa, cat.en)}
              </h2>
              <p className="mt-2 text-xs leading-6 text-[#6b6353]">
                {L(locale, cat.descFa, cat.descEn)}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {cat.subs.map((s) => (
                  <span key={s.slug} className="rounded-full bg-[#e7dcc4] px-2 py-0.5 text-[10px] text-[#5c5443]">
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
import { categories, prompts, L } from '@/lib/data'
import PromptCard from '@/components/prompt-card'
import CategoryIcon from '@/components/category-icon'

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

  const cat = categories.find((c) => c.slug === slug)
  if (!cat) notFound()

  let list = prompts.filter((p) => p.category === slug)
  if (sub) list = list.filter((p) => p.sub === sub)

  return (
    <section className="container-app py-16">
      <div className="flex items-center gap-5">
        <div className="glow-gold rounded-2xl bg-[#F2EAD8] p-4 text-[#171512]">
          <CategoryIcon name={cat.icon} />
        </div>
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            {L(locale, cat.fa, cat.en)}
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
            key={s.slug}
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
            <PromptCard key={item.slug} item={item} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="card mt-10 p-10 text-center text-sm text-ink-muted">
          {L(locale, 'به‌زودی پرامپت‌های این بخش اضافه می‌شود.', 'Prompts for this section are coming soon.')}
        </div>
      )}
    </section>
  )
}
EOF

cat > src/app/explore/page.tsx << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { prompts, typeLabel, L, type PromptType } from '@/lib/data'
import PromptCard from '@/components/prompt-card'

export const metadata = {
  title: 'کاوش',
  description: 'جستجو و فیلتر پرامپت‌های هوش مصنوعی',
}

const types: (PromptType | 'all')[] = ['all', 'image', 'video', 'text', 'code', 'audio']

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>
}) {
  const params = await searchParams
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  let list = prompts
  if (params.type && params.type !== 'all') {
    list = list.filter((p) => p.type === params.type)
  }
  if (params.q) {
    const q = params.q.toLowerCase()
    list = list.filter(
      (p) =>
        p.titleFa.includes(q) ||
        p.titleEn.toLowerCase().includes(q) ||
        p.tagsFa.some((t) => t.includes(q)) ||
        p.tagsEn.some((t) => t.toLowerCase().includes(q))
    )
  }

  return (
    <section className="container-app py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {L(locale, 'کاوش', 'Explore')}
      </h1>

      <form action="/explore" className="mt-6 max-w-2xl">
        <input
          name="q"
          defaultValue={params.q ?? ''}
          placeholder={L(locale, 'جستجو در پرامپت‌ها و تگ‌ها...', 'Search prompts and tags...')}
          className="input text-base"
        />
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        {types.map((tp) => (
          <Link
            key={tp}
            href={tp === 'all' ? '/explore' : '/explore?type=' + tp}
            className={'rounded-full border px-4 py-1.5 text-xs ' + ((params.type ?? 'all') === tp ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted')}
          >
            {tp === 'all'
              ? L(locale, 'همه', 'All')
              : L(locale, typeLabel[tp].fa, typeLabel[tp].en)}
          </Link>
        ))}
      </div>

      {list.length > 0 ? (
        <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
          {list.map((item) => (
            <PromptCard key={item.slug} item={item} locale={locale} />
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

cat > src/app/prompts/page.tsx << 'EOF'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { prompts, L } from '@/lib/data'
import PromptCard from '@/components/prompt-card'

export const metadata = {
  title: 'پرامپت‌ها',
  description: 'همه پرامپت‌های منتشرشده',
}

export default async function PromptsPage() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  return (
    <section className="container-app py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {L(locale, 'همه پرامپت‌ها', 'All Prompts')}
      </h1>

      <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
        {prompts.map((item) => (
          <PromptCard key={item.slug} item={item} locale={locale} />
        ))}
      </div>
    </section>
  )
}
EOF

echo "✅ Slogan + scroll story + real category navigation applied!"