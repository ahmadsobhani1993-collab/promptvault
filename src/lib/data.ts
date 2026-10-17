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

// فیلدهای لازم برای کارت‌ها (بدون متن کامل prompt)
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

// توجه: unstable_cache خروجی را JSON می‌کند؛ فیلدهای Date به string تبدیل می‌شوند.
// اگر مدل Category فیلد Date دارد و جایی از آن استفاده می‌کنی، این مورد را بررسی کن.
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
  light?: boolean // true: فقط فیلدهای کارت (سبک‌تر برای لیست‌ها)
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

// cache ری‌اکت: generateMetadata و خود صفحه یک کوئری مشترک می‌زنند
// هشدار: include user یعنی همه‌ی ستون‌های کاربر خوانده می‌شود؛
// مطمئن شو این فیلدها (مثل ایمیل) به Client Component پاس داده نمی‌شوند.
export const getPromptBySlug = cache(async (slug: string, includeUnpublished = false) => {
  return prisma.prompt.findFirst({
    where: includeUnpublished ? { slug } : { slug, status: 'PUBLISHED' },
    include: { category: true, sub: true, user: true },
  })
})

async function fetchRelatedPrompts(categoryId: string, excludeSlug: string, tagsFa: string[]) {
  const [byTags, byCategory]: [any[], any[]] = await Promise.all([
    tagsFa.length > 0
      ? prisma.prompt.findMany({
          where: {
            status: 'PUBLISHED',
            tagsFa: { hasSome: tagsFa },
            NOT: { slug: excludeSlug },
          },
          orderBy: { views: 'desc' },
          take: 12,
          select: cardSelect,
        })
      : Promise.resolve([]),
    prisma.prompt.findMany({
      where: {
        status: 'PUBLISHED',
        categoryId,
        NOT: { slug: excludeSlug },
      },
      orderBy: { views: 'desc' },
      take: 12,
      select: cardSelect,
    }),
  ])

  // اولویت با بیشترین اشتراک تگ، بعد بازدید
  const tagSet = new Set(tagsFa)
  const overlap = (item: any) =>
    (item.tagsFa as string[]).reduce((n, t) => n + (tagSet.has(t) ? 1 : 0), 0)

  const rankedByTags = byTags
    .map((item) => ({ item, score: overlap(item) }))
    .sort((a, b) => b.score - a.score || (b.item.views ?? 0) - (a.item.views ?? 0))
    .map((x) => x.item)

  const seen = new Set(rankedByTags.map((i) => i.id))
  const fill = byCategory.filter((i) => !seen.has(i.id))

  return [...rankedByTags, ...fill].slice(0, 6)
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

// هر دو شکل صدا زدن پشتیبانی می‌شود: getArticles(6) و getArticles({ take: 6 })
export function getArticles(opts?: number | { take?: number }) {
  const take = typeof opts === 'number' ? opts : opts?.take ?? 50
  return fetchArticles(take)
}

export const getArticleBySlug = cache(async (slug: string) =>
  prisma.article.findUnique({ where: { slug } })
)