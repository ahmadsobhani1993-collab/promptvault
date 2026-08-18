import { type MetadataRoute } from 'next'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://promptsfa.ir'
  const now = new Date()

  const [prompts, articles, cats] = await Promise.all([
    prisma.prompt.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 2000 }),
    prisma.article.findMany({ select: { slug: true, createdAt: true } }),
    prisma.category.findMany({ select: { slug: true } }),
  ])

  const statics: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: base + '/explore', changeFrequency: 'daily', priority: 0.9 },
    { url: base + '/blog', changeFrequency: 'daily', priority: 0.8 },
    { url: base + '/categories', changeFrequency: 'weekly', priority: 0.7 },
  ]

  return [
    ...statics,
    ...cats.map((c) => ({ url: base + '/categories/' + c.slug, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...prompts.map((p) => ({ url: base + '/prompts/' + p.slug, lastModified: p.createdAt, changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...articles.map((a) => ({ url: base + '/blog/' + a.slug, lastModified: a.createdAt, changeFrequency: 'monthly' as const, priority: 0.7 })),
  ]
}
