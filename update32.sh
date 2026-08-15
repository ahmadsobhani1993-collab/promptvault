#!/bin/bash
set -e

cat > src/app/sitemap.ts << 'EOF'
import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://promptvault-ahmad-5c7c.vercel.app'

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
EOF

cat > src/app/robots.ts << 'EOF'
import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://promptvault-ahmad-5c7c.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: BASE + '/sitemap.xml',
  }
}
EOF

# OG cards for prompt detail
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/prompts/[slug]/page.tsx'
let s = fs.readFileSync(p, 'utf8')
const old = 'return { title: item.titleFa, description: (item.descFa ?? item.prompt).slice(0, 150) }'
const nw = `return {
    title: item.titleFa,
    description: (item.descFa ?? item.prompt).slice(0, 150),
    openGraph: {
      title: item.titleFa,
      description: item.descFa ?? '',
      images: [{ url: item.img }],
      locale: 'fa_IR',
    },
    twitter: { card: 'summary_large_image', title: item.titleFa, description: item.descFa ?? '' },
  }`
if (s.includes(old)) {
  s = s.replace(old, nw)
  fs.writeFileSync(p, s)
  console.log('✅ prompt OG patched')
} else {
  console.log('⚠️ prompt OG pattern not found')
}
NODEEOF

# OG cards for blog detail
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/blog/[slug]/page.tsx'
let s = fs.readFileSync(p, 'utf8')
const old = 'return { title: a.titleFa, description: a.descFa }'
const nw = `return {
    title: a.titleFa,
    description: a.descFa,
    openGraph: {
      title: a.titleFa,
      description: a.descFa,
      images: [{ url: a.img }],
      locale: 'fa_IR',
    },
    twitter: { card: 'summary_large_image', title: a.titleFa, description: a.descFa },
  }`
if (s.includes(old)) {
  s = s.replace(old, nw)
  fs.writeFileSync(p, s)
  console.log('✅ blog OG patched')
} else {
  console.log('⚠️ blog OG pattern not found')
}
NODEEOF

echo "✅ SEO: sitemap + robots + OG cards!"