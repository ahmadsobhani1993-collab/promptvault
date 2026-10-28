import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { L } from '@/lib/l'
import type { Locale } from '@/lib/i18n'

export { L }
export type { Locale }

export function getPromptTypeLabel(type: string, locale: Locale) {
  const map: Record<string, { fa: string; en: string }> = {
    IMAGE: { fa: 'تصویر', en: 'Image' },
    TEXT: { fa: 'متن', en: 'Text' },
    VIDEO: { fa: 'ویدیو', en: 'Video' },
    CODE: { fa: 'کد', en: 'Code' },
    MUSIC: { fa: 'موسیقی', en: 'Music' },
    PRODUCTIVITY: { fa: 'بهره‌وری', en: 'Productivity' },
  }
  const t = map[type] || { fa: type, en: type }
  return L(locale, t.fa, t.en)
}

export const cardSelect = {
  id: true,
  slug: true,
  titleFa: true,
  titleEn: true,
  descFa: true,
  descEn: true,
  model: true,
  type: true,
  img: true,
  likes: true,
  saves: true,
  prompt: true,
  category: { select: { nameFa: true, nameEn: true, slug: true } },
  sub: { select: { fa: true, en: true, slug: true } },
}

// Light select for related cards: no prompt body, no long descriptions.
const relatedSelect = {
  id: true,
  slug: true,
  titleFa: true,
  titleEn: true,
  model: true,
  type: true,
  img: true,
  likes: true,
  saves: true,
  tagsFa: true,
  createdAt: true,
  category: { select: { nameFa: true, nameEn: true, slug: true } },
  sub: { select: { fa: true, en: true, slug: true } },
}

const getCategoriesCached = unstable_cache(
  async () =>
    prisma.category.findMany({
      orderBy: { order: 'asc' },
      include: { subs: true },
    }),
  ['categories'],
  { revalidate: 3600, tags: ['categories'] }
)

export const getCategories = cache(() => getCategoriesCached())

export async function getPrompts(opts?: {
  type?: string
  q?: string
  categorySlug?: string
  subSlug?: string
  tags?: string[]
  take?: number
  light?: boolean
}) {
  const where: any = { status: 'PUBLISHED' }
  if (opts?.type) where.type = opts.type
  if (opts?.categorySlug) where.category = { slug: opts.categorySlug }
  if (opts?.subSlug) where.sub = { slug: opts.subSlug }
  if (opts?.tags && opts.tags.length > 0) where.tagsFa = { hasSome: opts.tags }
  if (opts?.q) {
    where.OR = [
      { titleFa: { contains: opts.q, mode: 'insensitive' } },
      { titleEn: { contains: opts.q, mode: 'insensitive' } },
      { descFa: { contains: opts.q, mode: 'insensitive' } },
      { prompt: { contains: opts.q, mode: 'insensitive' } },
    ]
  }

  const base = {
    where,
    take: opts?.take ?? 24,
    orderBy: { createdAt: 'desc' as const },
  }

  return prisma.prompt.findMany({
    ...base,
    select: {
      id: true,
      slug: true,
      categoryId: true,
      titleFa: true,
      titleEn: true,
      model: true,
      type: true,
      img: true,
      likes: true,
      saves: true,
      createdAt: true,
      category: { select: { nameFa: true, nameEn: true, slug: true } },
      sub: { select: { fa: true, en: true, slug: true } },
    },
  })
}

// Used by admin pages and APIs that may need every column.
export const getPromptBySlug = cache(async (slug: string, includeUnpublished = false) => {
  return prisma.prompt.findFirst({
    where: includeUnpublished ? { slug } : { slug, status: 'PUBLISHED' },
    include: {
      category: true,
      sub: true,
      user: { select: { name: true, image: true } },
    },
  })
})

// Used only by the public prompt page: no prompt text, no imgData/imgType.
export const getPromptForPage = cache(async (slug: string) => {
  return prisma.prompt.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: {
      id: true,
      slug: true,
      titleFa: true,
      titleEn: true,
      descFa: true,
      descEn: true,
      usageFa: true,
      usageEn: true,
      img: true,
      model: true,
      type: true,
      categoryId: true,
      tagsFa: true,
      likes: true,
      saves: true,
      createdAt: true,
      category: { select: { nameFa: true, nameEn: true, slug: true } },
      sub: { select: { fa: true, en: true, slug: true } },
      user: { select: { name: true, image: true } },
    },
  })
})

// One shared pool per category, cached for 24h and reused by every slug of that category.
const getCategoryPoolCached = unstable_cache(
  async (categoryId: string) =>
    prisma.prompt.findMany({
      where: { status: 'PUBLISHED', categoryId },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: relatedSelect,
    }),
  ['related-pool'],
  { revalidate: 86400, tags: ['prompts'] }
)

export async function getRelatedPrompts(categoryId: string, excludeSlug: string, tagsFa: string[]) {
  if (!categoryId) return []

  const pool = (await getCategoryPoolCached(categoryId)).filter((p) => p.slug !== excludeSlug)
  const tagSet = new Set(tagsFa || [])

  // Stable per-slug number so each page gets a different (but fixed) mix
  let h = 0
  for (const ch of excludeSlug) h = (h * 31 + ch.charCodeAt(0)) >>> 0

  const scored = pool.map((p, i) => ({
    p,
    score:
      (Array.isArray(p.tagsFa) ? p.tagsFa.filter((t) => tagSet.has(t)).length : 0) * 100 +
      ((h + i * 7919) % 100),
  }))
  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, 4).map((s) => s.p)
}

// List view: skip the full article body (contentFa/contentEn)
const articleListSelect = {
  id: true,
  slug: true,
  status: true,
  titleFa: true,
  titleEn: true,
  descFa: true,
  descEn: true,
  img: true,
  tagFa: true,
  tagEn: true,
  dateFa: true,
  dateEn: true,
  readFa: true,
  readEn: true,
  createdAt: true,
}

const fetchArticles = cache(async (take: number) =>
  prisma.article.findMany({
    take,
    orderBy: { createdAt: 'desc' },
    select: articleListSelect,
  })
)

export function getArticles(opts?: number | { take?: number }) {
  const take = typeof opts === 'number' ? opts : opts?.take ?? 50
  return fetchArticles(take)
}

export const getArticleBySlug = cache(async (slug: string) =>
  prisma.article.findUnique({ where: { slug } })
)