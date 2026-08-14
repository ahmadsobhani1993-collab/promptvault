#!/bin/bash
set -e

mkdir -p 'src/app/prompts/[slug]' 'src/app/blog/[slug]'

cat > src/lib/i18n.ts << 'EOF'
export type Locale = 'fa' | 'en'

export interface Dict {
  nav: {
    explore: string
    prompts: string
    categories: string
    creators: string
    blog: string
  }
  submit: string
  login: string
  logout: string
  heroLabel: string
  heroSubtitle: string
  searchPlaceholder: string
  trending: string
  categoriesTitle: string
  blogSection: string
  readMore: string
  copyPrompt: string
  copied: string
  likes: string
  saves: string
  views: string
  footerTagline: string
  rights: string
  langToggle: string
}

export const dictionaries: Record<Locale, Dict> = {
  en: {
    nav: {
      explore: 'Explore',
      prompts: 'Prompts',
      categories: 'Categories',
      creators: 'Creators',
      blog: 'Blog',
    },
    submit: 'Submit Prompt',
    login: 'Login',
    logout: 'Sign out',
    heroLabel: 'Prompt Discovery Platform',
    heroSubtitle:
      'Discover premium AI prompts for image, video, text, code, music, and productivity.',
    searchPlaceholder: 'Search thousands of AI prompts...',
    trending: 'Trending Prompts',
    categoriesTitle: 'Explore Categories',
    blogSection: 'AI Blog & Tutorials',
    readMore: 'Read more',
    copyPrompt: 'Copy Prompt',
    copied: 'Copied!',
    likes: 'likes',
    saves: 'saves',
    views: 'views',
    footerTagline: 'Beautiful but fast.',
    rights: 'All rights reserved.',
    langToggle: 'فارسی',
  },
  fa: {
    nav: {
      explore: 'کاوش',
      prompts: 'پرامپت‌ها',
      categories: 'دسته‌بندی‌ها',
      creators: 'سازندگان',
      blog: 'وبلاگ',
    },
    submit: 'ارسال پرامپت',
    login: 'ورود',
    logout: 'خروج',
    heroLabel: 'پلتفرم کشف پرامپت هوش مصنوعی',
    heroSubtitle:
      'هزاران پرامپت حرفه‌ای هوش مصنوعی برای تصویر، ویدیو، متن، کد، موسیقی و بهره‌وری کشف کن.',
    searchPlaceholder: 'جستجو در هزاران پرامپت هوش مصنوعی...',
    trending: 'پرامپت‌های داغ',
    categoriesTitle: 'دسته‌بندی‌ها',
    blogSection: 'وبلاگ و آموزش هوش مصنوعی',
    readMore: 'ادامه مطلب',
    copyPrompt: 'کپی پرامپت',
    copied: 'کپی شد!',
    likes: 'پسند',
    saves: 'ذخیره',
    views: 'بازدید',
    footerTagline: 'زیبا اما سریع.',
    rights: 'تمامی حقوق محفوظ است.',
    langToggle: 'English',
  },
}
EOF

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
  prompt: string
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

export interface Article {
  slug: string
  titleFa: string
  titleEn: string
  descFa: string
  descEn: string
  img: string
  tagFa: string
  tagEn: string
  dateFa: string
  dateEn: string
  readFa: string
  readEn: string
  contentFa: string[]
  contentEn: string[]
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
    prompt:
      'Cinematic portrait of a woman in the rain at night, neon reflections, 85mm lens, f/1.8, soft rim light, film grain, moody color grade --ar 4:5 --v 6',
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
    prompt:
      'Luxury perfume bottle on a black stone pedestal, dramatic studio lighting, gold accents, ultra sharp product photography, soft shadows --ar 4:5',
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
    prompt:
      'Dark fantasy warrior character, weathered armor, ember particles, volumetric fog, concept art style, highly detailed --ar 1:1',
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
    prompt:
      'Futuristic white architecture at sunset, sweeping curves, cinematic wide shot, photorealistic, golden hour light --ar 16:9',
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
    prompt:
      'Studio portrait with colorful smoke background, bold glasses, high fashion editorial, crisp detail --ar 4:5',
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
    prompt:
      'Cinematic 10s product teaser: slow dolly-in, dramatic lighting, macro details, filmic color grade',
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
    prompt:
      'Neon-lit music video scene, retro-futuristic city, anamorphic lens flares, smooth camera motion',
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
    prompt:
      'Write 5 persuasive ad headlines for a luxury skincare brand. Tone: confident and minimal. Under 8 words each.',
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
    prompt:
      'Act as a senior content strategist. Create a 7-day content plan for an AI tools brand with hooks and CTAs.',
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
    prompt:
      'Generate a production-ready React component with TypeScript, Tailwind, accessibility, and loading states.',
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
    prompt:
      'Find the bug in this code, explain the root cause, and provide an optimized fix with tests.',
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
    prompt:
      'Epic cinematic score, slow build, hybrid orchestra + synth, emotional climax at 1:30, 2 minutes total.',
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
    prompt:
      'Plan my week: 3 deep-work blocks daily, energy-based task mapping, and a Friday review ritual.',
    likes: '110',
    saves: '480',
    views: '4.4K',
  },
]

export const articles: Article[] = [
  {
    slug: 'midjourney-starter',
    titleFa: 'راهنمای شروع میدجرنی در ۱۰ دقیقه',
    titleEn: 'Midjourney Starter Guide in 10 Minutes',
    descFa: 'از ساخت اکانت تا اولین تصویر حرفه‌ای؛ هر آنچه برای شروع نیاز داری.',
    descEn: 'From account setup to your first pro image; everything you need to start.',
    img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop',
    tagFa: 'میدجرنی',
    tagEn: 'Midjourney',
    dateFa: '۲۴ تیر ۱۴۰۵',
    dateEn: 'Jul 15, 2026',
    readFa: '۶ دقیقه',
    readEn: '6 min',
    contentFa: [
      'میدجرنی هنوز یکی از قدرتمندترین ابزارهای تولید تصویر است. برای شروع فقط به یک اکانت و کمی شناخت از ساختار پرامپت نیاز داری.',
      'ساختار پایه یک پرامپت خوب یعنی: سوژه اصلی، محیط، نور، لنز و سبک. همین پنج عنصر کیفیت خروجی را چند برابر می‌کند.',
      'در پایان، پارامترهایی مثل --ar برای نسبت تصویر و --v برای نسخه مدل را یاد بگیر تا کنترل کامل داشته باشی.',
    ],
    contentEn: [
      'Midjourney remains one of the most powerful image tools. To start, you only need an account and basic prompt structure knowledge.',
      'A good prompt base means: main subject, environment, light, lens, and style. These five elements multiply output quality.',
      'Finally, learn parameters like --ar for aspect ratio and --v for model version to take full control.',
    ],
  },
  {
    slug: 'better-prompts',
    titleFa: '۱۰ تکنیک نوشتن پرامپت بهتر',
    titleEn: '10 Prompt Writing Techniques',
    descFa: 'تکنیک‌هایی که تفاوت یک خروجی معمولی و یک خروجی حرفه‌ای را می‌سازند.',
    descEn: 'Techniques that make the difference between average and professional output.',
    img: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=1200&auto=format&fit=crop',
    tagFa: 'آموزش',
    tagEn: 'Tutorial',
    dateFa: '۱۸ تیر ۱۴۰۵',
    dateEn: 'Jul 9, 2026',
    readFa: '۸ دقیقه',
    readEn: '8 min',
    contentFa: [
      'شفافیت مهم‌تر از طولانی بودن است. به جای انبوهی از کلمات، دقیقاً بگو چه می‌خواهی و چه چیزی را نمی‌خواهی.',
      'از قیدهای قابل اندازه‌گیری استفاده کن: زاویه دوربین، نوع نور، پالت رنگی و حس کلی تصویر.',
      'همیشه یک نسخه پایه بساز و بعد با تغییر تک‌تک عناصر، اثر هر کدام را جداگانه ببین؛ این سریع‌ترین راه یادگیری است.',
    ],
    contentEn: [
      'Clarity beats length. Instead of piling words, say exactly what you want and what you do not want.',
      'Use measurable constraints: camera angle, light type, color palette, and overall mood.',
      'Always build a base version, then change one element at a time to see its effect; this is the fastest way to learn.',
    ],
  },
  {
    slug: 'flux-vs-sd',
    titleFa: 'مقایسه Flux و Stable Diffusion',
    titleEn: 'Flux vs Stable Diffusion',
    descFa: 'کدام مدل برای کدام کار؟ یک مقایسه کاربردی برای انتخاب درست.',
    descEn: 'Which model for which job? A practical comparison for the right choice.',
    img: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=1200&auto=format&fit=crop',
    tagFa: 'مقایسه',
    tagEn: 'Comparison',
    dateFa: '۱۰ تیر ۱۴۰۵',
    dateEn: 'Jul 1, 2026',
    readFa: '۷ دقیقه',
    readEn: '7 min',
    contentFa: [
      'Flux در رعایت دقیق پرامپت و متن داخل تصویر پیشتاز است و برای کارهای تجاری سریع عالی عمل می‌کند.',
      'Stable Diffusion با اکوسیستم LoRA و ControlNet هنوز بی‌رقیب‌ترین گزینه برای کنترل جزئیات و سبک‌های سفارشی است.',
      'قاعده ساده: سرعت و دقت پرامپت با Flux، کنترل عمیق و سفارشی‌سازی با SD.',
    ],
    contentEn: [
      'Flux leads in prompt adherence and in-image text, great for fast commercial work.',
      'Stable Diffusion with LoRA and ControlNet remains unbeatable for deep control and custom styles.',
      'Simple rule: speed and prompt accuracy with Flux; deep control and customization with SD.',
    ],
  },
]
EOF

cat > src/components/locale-provider.tsx << 'EOF'
'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
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
        startTransition(() => {
          document.cookie = 'locale=' + next + '; path=/; max-age=31536000'
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

cat > src/components/copy-button.tsx << 'EOF'
'use client'

import { useState } from 'react'

export default function CopyButton({
  text,
  label,
  copiedLabel,
}: {
  text: string
  label: string
  copiedLabel: string
}) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {}
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="btn-primary"
    >
      {copied ? copiedLabel : label}
    </button>
  )
}
EOF

cat > src/components/prompt-card.tsx << 'EOF'
import Link from 'next/link'
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
    <Link href={'/prompts/' + item.slug} className="block">
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
          {item.tagsFa
            .map((tag, i) => L(locale, tag, item.tagsEn[i] ?? tag))
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
    </Link>
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
    { href: '/blog', label: t.nav.blog },
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

cat > src/app/page.tsx << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { dictionaries, type Locale } from '@/lib/i18n'
import { categories, prompts, articles, L } from '@/lib/data'
import PromptCard from '@/components/prompt-card'
import CategoryIcon from '@/components/category-icon'

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
      <section className="hero-radial snap-section flex min-h-[92vh] items-center border-b border-line/60">
        <div className="container-app py-16 text-center">
          <p className={'text-xs font-semibold uppercase text-gold-bright ' + (locale === 'fa' ? '' : 'tracking-[0.35em]')}>
            {t.heroLabel}
          </p>

          <h1 className="title-solid mt-5 font-display text-4xl font-extrabold tracking-tight md:text-6xl">
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

      <section className="snap-section flex min-h-screen flex-col justify-center py-16">
        <div className="container-app">
          <h2 className="text-center font-display text-2xl font-bold tracking-tight md:text-3xl">
            {t.trending}
          </h2>

          <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
            {prompts.slice(0, 5).map((item) => (
              <PromptCard key={item.slug} item={item} locale={locale} />
            ))}
          </div>
        </div>
      </section>

      <section className="snap-section flex min-h-screen flex-col justify-center border-t border-line/60 py-16">
        <div className="container-app">
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
        </div>
      </section>

      <section className="snap-section flex min-h-screen flex-col justify-center border-t border-line/60 py-16">
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
            {articles.map((a) => (
              <Link key={a.slug} href={'/blog/' + a.slug} className="card group overflow-hidden transition-colors hover:border-line-strong">
                <img src={a.img} alt={L(locale, a.titleFa, a.titleEn)} loading="lazy" className="h-44 w-full object-cover" />
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
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
EOF

cat > 'src/app/prompts/[slug]/page.tsx' << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { type Locale } from '@/lib/i18n'
import { prompts, categories, typeLabel, L } from '@/lib/data'
import PromptCard from '@/components/prompt-card'
import CopyButton from '@/components/copy-button'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const item = prompts.find((p) => p.slug === slug)
  if (!item) return {}
  return {
    title: item.titleFa,
    description: item.prompt.slice(0, 150),
  }
}

export default async function PromptDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const item = prompts.find((p) => p.slug === slug)
  if (!item) notFound()

  const cat = categories.find((c) => c.slug === item.category)
  const related = prompts.filter((p) => p.category === item.category && p.slug !== slug).slice(0, 3)

  return (
    <section className="container-app py-16">
      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <img
            src={item.img}
            alt={L(locale, item.titleFa, item.titleEn)}
            className="glow-gold w-full rounded-2xl object-cover"
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            {cat && (
              <Link href={'/categories/' + cat.slug} className="gold-badge">
                {L(locale, cat.fa, cat.en)}
              </Link>
            )}
            <span className="badge">
              {L(locale, typeLabel[item.type].fa, typeLabel[item.type].en)}
            </span>
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
              <PromptCard key={r.slug} item={r} locale={locale} />
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
import { articles, L } from '@/lib/data'

export const metadata = {
  title: 'وبلاگ',
  description: 'آموزش و مقالات هوش مصنوعی',
}

export default async function BlogPage() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  return (
    <section className="container-app py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {L(locale, 'وبلاگ و آموزش هوش مصنوعی', 'AI Blog & Tutorials')}
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-ink-muted">
        {L(
          locale,
          'مقالات آموزشی برای اینکه بهتر بسازی، بهتر بنویسی و بهتر فکر کنی.',
          'Educational articles to build better, write better, and think better.'
        )}
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <Link key={a.slug} href={'/blog/' + a.slug} className="card group overflow-hidden transition-colors hover:border-line-strong">
            <img src={a.img} alt={L(locale, a.titleFa, a.titleEn)} loading="lazy" className="h-48 w-full object-cover" />
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="gold-badge">{L(locale, a.tagFa, a.tagEn)}</span>
                <span className="text-[10px] text-ink-faint">{L(locale, a.dateFa, a.dateEn)}</span>
              </div>
              <h2 className="text-sm font-bold text-ink">{L(locale, a.titleFa, a.titleEn)}</h2>
              <p className="line-clamp-2 text-xs leading-6 text-ink-muted">
                {L(locale, a.descFa, a.descEn)}
              </p>
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
import { articles, L } from '@/lib/data'

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

  return (
    <article className="container-app max-w-3xl py-16">
      <Link href="/blog" className="text-xs text-gold-bright hover:text-gold">
        {L(locale, '← بازگشت به وبلاگ', '← Back to blog')}
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <span className="gold-badge">{L(locale, a.tagFa, a.tagEn)}</span>
        <span className="text-xs text-ink-faint">{L(locale, a.dateFa, a.dateEn)}</span>
        <span className="text-xs text-ink-faint">{L(locale, a.readFa, a.readEn)}</span>
      </div>

      <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        {L(locale, a.titleFa, a.titleEn)}
      </h1>

      <img src={a.img} alt={L(locale, a.titleFa, a.titleEn)} className="glow-gold mt-8 w-full rounded-2xl object-cover" />

      <div className="mt-8 space-y-6">
        {content.map((p) => (
          <p key={p.slice(0, 20)} className="text-base leading-8 text-ink-muted">
            {p}
          </p>
        ))}
      </div>
    </article>
  )
}
EOF

echo "✅ Snap sections + solid slogan + clickable prompts + blog applied!"bash update4.sh