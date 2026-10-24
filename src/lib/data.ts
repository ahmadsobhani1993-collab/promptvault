import { cache } from 'react'
import { unstable_cache } from 'next/cache'
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

const cardSelect = {
  id: true,
  slug: true,
  titleFa: true,
  titleEn: true,
  img: true,
  model: true,
  type: true,
  tagsFa: true,
  tagsEn: true,
  views: true,
  likes: true,
  saves: true,
  stars: true,
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

  const base = {
    where,
    orderBy: { createdAt: 'desc' as const },
    take: opts?.take,
  }

  if (opts?.light) {
    return prisma.prompt.findMany({
      ...base,
      select: { ...cardSelect, createdAt: true },
    })
  }

  return prisma.prompt.findMany({
    ...base,
    include: { category: true, sub: true },
  })
}

export const getPromptBySlug = cache(async (slug: string, includeUnpublished = false) => {
  return prisma.prompt.findFirst({
    where: includeUnpublished ? { slug } : { slug, status: 'PUBLISHED' },
    include: { category: true, sub: true, user: true },
  })
})

// استخر چرخشی روزانه برای نمایش پرامپت‌های قدیمی و جدید
async function fetchRelatedPrompts(categoryId: string, excludeSlug: string, tagsFa: string[]) {
  const currentDay = new Date().getDate()
  const primeMultiplier = 17
  const poolSize = 60

  const getRotatingPool = async (whereCondition: any) => {
    const total = await prisma.prompt.count({ where: whereCondition })
    
    if (total <= poolSize) {
      return prisma.prompt.findMany({ 
        where: whereCondition, 
        take: poolSize, 
        select: cardSelect 
      })
    }
    
    const maxOffset = total - poolSize
    const dailySkip = (currentDay * primeMultiplier) % maxOffset

    return prisma.prompt.findMany({
      where: whereCondition,
      skip: dailySkip,
      take: poolSize,
      select: cardSelect,
    })
  }

  const whereTags = tagsFa.length > 0 ? {
    status: 'PUBLISHED',
    tagsFa: { hasSome: tagsFa },
    NOT: { slug: excludeSlug },
  } : null

  const whereCategory = {
    status: 'PUBLISHED',
    categoryId,
    NOT: { slug: excludeSlug },
  }

  const [byTags, byCategory] = await Promise.all([
    whereTags ? getRotatingPool(whereTags) : Promise.resolve([]),
    getRotatingPool(whereCategory),
  ])

  const shuffle = (array: any[]) => array.sort(() => Math.random() - 0.5)
  const shuffledTags = shuffle(byTags)
  const shuffledCategory = shuffle(byCategory)

  const seen = new Set<string>()
  const result: any[] = []

  for (const item of [...shuffledTags, ...shuffledCategory]) {
    if (result.length >= 6) break
    if (!seen.has(item.id)) {
      seen.add(item.id)
      result.push(item)
    }
  }

  return result
}

const getRelatedPromptsCached = unstable_cache(
  fetchRelatedPrompts,
  ['related-prompts'],
  { revalidate: 600, tags: ['prompts'] }
)

export async function getRelatedPrompts(categoryId: string, excludeSlug: string, tagsFa: string[] = []) {
  return getRelatedPromptsCached(categoryId, excludeSlug, tagsFa ?? [])
}

const fetchArticles = cache(async (take: number) =>
  prisma.article.findMany({ take, orderBy: { createdAt: 'desc' } })
)

export function getArticles(opts?: number | { take?: number }) {
  const take = typeof opts === 'number' ? opts : opts?.take ?? 50
  return fetchArticles(take)
}

export const getArticleBySlug = cache(async (slug: string) =>
  prisma.article.findUnique({ where: { slug } })
)
