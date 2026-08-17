import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://promptvault-ahmad-5c7c.vercel.app'

export const dynamic = 'force-dynamic'
export const revalidate = 3600
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [prompts, categories, articles] = await Promise.all([
    prisma.prompt.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, createdAt: true } }),
    prisma.category.findMany({ select: { slug: true } }),
    prisma.article.findMany({ select: { slug: true, createdAt: true } }),
  ])

  const now = new Date()

  const statics: MetadataRoute.Sitemap = ['/', '/explore', '/prompts', '/categories', '/blog'].map((p) => ({
    url: BASE + p,
    lastModified: now,
    changeFrequency: 'daily',
    priority: p === '/' ? 1 : 0.8,
  }))

  return [
    ...statics,
    ...prompts.map((p) => ({
      url: BASE + '/prompts/' + p.slug,
      lastModified: p.createdAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...categories.map((c) => ({
      url: BASE + '/categories/' + c.slug,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...articles.map((a) => ({
      url: BASE + '/blog/' + a.slug,
      lastModified: a.createdAt,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ]
}
