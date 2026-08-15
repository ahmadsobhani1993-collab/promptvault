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
  take?: number
}) {
  const where: any = { status: 'PUBLISHED' }
  if (opts?.type) where.type = opts.type
  if (opts?.categorySlug) where.category = { slug: opts.categorySlug }
  if (opts?.subSlug) where.sub = { slug: opts.subSlug }
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
