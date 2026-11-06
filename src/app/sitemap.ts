import { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://promptsfa.ir'

  const [prompts, categories, articles] = await Promise.all([
    prisma.prompt.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    }).catch(() => []),
    prisma.category.findMany({ select: { slug: true } }).catch(() => []),
    prisma.article.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []),
  ])

  const promptEntries: MetadataRoute.Sitemap = prompts.flatMap((p) => [
    {
      url: `${baseUrl}/prompts/${p.slug}`,
      lastModified: p.createdAt,
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: {
        languages: {
          'fa-IR': `${baseUrl}/prompts/${p.slug}`,
          'en-US': `${baseUrl}/en/prompts/${p.slug}`,
        },
      },
    },
    {
      url: `${baseUrl}/en/prompts/${p.slug}`,
      lastModified: p.createdAt,
      changeFrequency: 'weekly',
      priority: 0.7,
      alternates: {
        languages: {
          'fa-IR': `${baseUrl}/prompts/${p.slug}`,
          'en-US': `${baseUrl}/en/prompts/${p.slug}`,
        },
      },
    },
  ])

  const pairedRoutes = [
    { path: '', lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1.0 },
    { path: '/explore', lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { path: '/categories', lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.7 },
    { path: '/blog', lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.7 },
    { path: '/news', lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.7 },
    { path: '/subtitle', lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.7 },
    { path: '/transcribe', lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.6 },
  ]

  const staticRoutes: MetadataRoute.Sitemap = pairedRoutes.flatMap(({ path, ...options }) => [
    {
      url: `${baseUrl}${path || '/'}`,
      ...options,
      alternates: {
        languages: {
          'fa-IR': `${baseUrl}${path || '/'}`,
          'en-US': `${baseUrl}/en${path}`,
        },
      },
    },
    {
      url: `${baseUrl}/en${path}`,
      ...options,
      alternates: {
        languages: {
          'fa-IR': `${baseUrl}${path || '/'}`,
          'en-US': `${baseUrl}/en${path}`,
        },
      },
    },
  ])

  const categoryEntries: MetadataRoute.Sitemap = categories.flatMap((category) => [
    {
      url: `${baseUrl}/categories/${category.slug}`,
      changeFrequency: 'weekly',
      priority: 0.6,
      alternates: {
        languages: {
          'fa-IR': `${baseUrl}/categories/${category.slug}`,
          'en-US': `${baseUrl}/en/categories/${category.slug}`,
        },
      },
    },
    {
      url: `${baseUrl}/en/categories/${category.slug}`,
      changeFrequency: 'weekly',
      priority: 0.6,
      alternates: {
        languages: {
          'fa-IR': `${baseUrl}/categories/${category.slug}`,
          'en-US': `${baseUrl}/en/categories/${category.slug}`,
        },
      },
    },
  ])

  const articleEntries: MetadataRoute.Sitemap = articles.flatMap((article) => [
    {
      url: `${baseUrl}/blog/${article.slug}`,
      lastModified: article.createdAt,
      changeFrequency: 'monthly',
      priority: 0.6,
      alternates: {
        languages: {
          'fa-IR': `${baseUrl}/blog/${article.slug}`,
          'en-US': `${baseUrl}/en/blog/${article.slug}`,
        },
      },
    },
    {
      url: `${baseUrl}/en/blog/${article.slug}`,
      lastModified: article.createdAt,
      changeFrequency: 'monthly',
      priority: 0.6,
      alternates: {
        languages: {
          'fa-IR': `${baseUrl}/blog/${article.slug}`,
          'en-US': `${baseUrl}/en/blog/${article.slug}`,
        },
      },
    },
  ])

  return [...staticRoutes, ...categoryEntries, ...articleEntries, ...promptEntries]
}
