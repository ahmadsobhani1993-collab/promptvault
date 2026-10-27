import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { type Locale } from '@/lib/i18n'

export function L(locale: Locale, fa: string, en?: string) {
  if (locale === 'en' && en) return en
  return fa
}

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
      titleFa: true,
      titleEn: true,
      categoryId: true, 
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

export const getPromptBySlug = cache(async (slug: string, includeUnpublished = false) => {
  return prisma.prompt.findFirst({
    where: includeUnpublished ? { slug } : { slug, status: 'PUBLISHED' },
    include: { category: true, sub: true, user: true },
  })
})

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
    getRotatingPool(whereCategory)
  ])

  const map = new Map<string, any>()
  for (const item of [...byTags, ...byCategory]) {
    if (!map.has(item.id)) map.set(item.id, item)
  }

  const merged = Array.from(map.values())
  for (let i = merged.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [merged[i], merged[j]] = [merged[j], merged[i]]
  }

  return merged.slice(0, 4)
}

export const getRelatedPrompts = cache(fetchRelatedPrompts)

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
