#!/bin/bash
set -e

cat >> src/app/globals.css << 'EOF'

@media (max-width: 768px) {
  html, body {
    scroll-snap-type: none !important;
    -webkit-overflow-scrolling: touch;
  }
  .snap-section {
    scroll-snap-align: none !important;
    min-height: auto !important;
  }
}
EOF

cat > src/components/safe-img.tsx << 'EOF'
'use client'

import { useState } from 'react'

const FALLBACK = 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop'

export default function SafeImg({
  src,
  alt,
  className,
  loading,
}: {
  src: string
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
}) {
  const [cur, setCur] = useState(src)
  return (
    <img
      src={cur}
      alt={alt}
      className={className}
      loading={loading ?? 'lazy'}
      onError={() => {
        if (cur !== FALLBACK) setCur(FALLBACK)
      }}
    />
  )
}
EOF

cat > src/components/tag-filter.tsx << 'EOF'
'use client'

import { useRouter } from 'next/navigation'

export default function TagFilter({ all, selected }: { all: string[]; selected: string[] }) {
  const router = useRouter()

  const apply = (tags: string[]) => {
    const q = new URLSearchParams(window.location.search)
    if (tags.length) q.set('tags', tags.join(','))
    else q.delete('tags')
    router.push('/explore?' + q.toString())
  }

  const toggle = (t: string) => {
    if (selected.includes(t)) apply(selected.filter((x) => x !== t))
    else if (selected.length < 2) apply([...selected, t])
  }

  return (
    <div className="mt-6">
      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-muted">فیلترهای فعال:</span>
          {selected.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className="flex items-center gap-1.5 rounded-full border border-gold bg-gold/15 px-3 py-1 text-xs text-gold-bright transition-colors hover:bg-gold/25"
            >
              {t}
              <span className="text-sm font-bold leading-none">×</span>
            </button>
          ))}
          <button type="button" onClick={() => apply([])} className="text-xs text-ink-faint transition-colors hover:text-danger">
            پاک کردن همه
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {all.map((t) => {
          const active = selected.includes(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className={
                'rounded-full border px-3 py-1 text-xs transition-colors ' +
                (active
                  ? 'border-gold bg-gold/15 text-gold-bright'
                  : 'border-line bg-elevated text-ink-muted hover:border-gold/40 hover:text-gold-bright')
              }
            >
              {t}
            </button>
          )
        })}
      </div>
    </div>
  )
}
EOF

cat > src/components/prompt-card.tsx << 'EOF'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n'
import { L, getPromptTypeLabel } from '@/lib/data'
import SafeImg from '@/components/safe-img'

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

export default function PromptCard({
  item,
  locale,
  cornerTags,
}: {
  item: PromptItem
  locale: Locale
  cornerTags?: string[]
}) {
  return (
    <article className="card-cream glow-gold p-3 transition-transform hover:-translate-y-1">
      <Link href={'/prompts/' + item.slug} className="block">
        <div className="relative">
          <SafeImg src={item.img} alt={L(locale, item.titleFa, item.titleEn)} className="aspect-square w-full rounded-lg object-cover" />
          <span className="absolute right-2 top-2 rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold text-[#171512]">
            {getPromptTypeLabel(item.type, locale)}
          </span>
          {cornerTags && cornerTags.length > 0 && (
            <span className="absolute left-2 top-2 flex flex-col items-start gap-1">
              {cornerTags.map((t) => (
                <span key={t} className="rounded-full bg-[#171512]/85 px-2 py-0.5 text-[9px] text-gold-bright">
                  {t}
                </span>
              ))}
            </span>
          )}
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
            href={'/explore?tags=' + encodeURIComponent(tag)}
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
  tags?: string[]
  take?: number
}) {
  const where: any = { status: 'PUBLISHED' }
  if (opts?.type) where.type = opts.type
  if (opts?.categorySlug) where.category = { slug: opts.categorySlug }
  if (opts?.subSlug) where.sub = { slug: opts.subSlug }
  if (opts?.tags && opts.tags.length > 0) where.tagsFa = { hasEvery: opts.tags }
  if (opts?.q) {
    const q = opts.q
    where.OR = [
      { titleFa: { contains: q, mode: 'insensitive' } },
      { titleEn: { contains: q, mode: 'insensitive' } },
      { prompt: { contains: q, mode: 'insensitive' } },
      { tagsFa: { hasSome: [q] } },
      { tagsEn: { hasSome: [q] } },
    ]
  }

  return prisma.prompt.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: opts?.take,
    include: { category: true, sub: true },
  })
}

export async function getPromptBySlug(slug: string) {
  return prisma.prompt.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: { category: true, sub: true },
  })
}

export async function getRelatedPrompts(categoryId: string, excludeSlug: string) {
  return prisma.prompt.findMany({
    where: { categoryId, status: 'PUBLISHED', NOT: { slug: excludeSlug } },
    orderBy: { createdAt: 'desc' },
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

cat > src/app/explore/page.tsx << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { getPrompts, promptTypes, L } from '@/lib/data'
import { TAG_VOCAB } from '@/lib/gemini'
import PromptCard from '@/components/prompt-card'
import TagFilter from '@/components/tag-filter'

export const metadata = { title: 'کاوش', description: 'جستجو و فیلتر پرامپت‌ها' }
export const dynamic = 'force-dynamic'

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; tags?: string }>
}) {
  const params = await searchParams
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const selectedTags = (params.tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 2)

  const prompts = await getPrompts({ type: params.type, q: params.q, tags: selectedTags })

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

      <TagFilter all={TAG_VOCAB.map((t) => t.fa)} selected={selectedTags} />

      {prompts.length > 0 ? (
        <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
          {prompts.map((item) => (
            <PromptCard key={item.id} item={item} locale={locale} cornerTags={selectedTags} />
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

# tag links on prompt detail -> new tag filter
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/prompts/[slug]/page.tsx'
let s = fs.readFileSync(p, 'utf8')
const old = "href={'/explore?q=' + encodeURIComponent(tag)}"
const nw = "href={'/explore?tags=' + encodeURIComponent(tag)}"
if (s.includes(old)) {
  s = s.split(old).join(nw)
  fs.writeFileSync(p, s)
  console.log('✅ detail tag links patched')
} else {
  console.log('⚠️ detail tag pattern not found')
}
NODEEOF

echo "✅ Tag filter (max 2 + ×) + safe images + smooth mobile scroll!"