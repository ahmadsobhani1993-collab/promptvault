#!/bin/bash
set -e

# ---------- find sitemap ----------
if [ -f src/app/sitemap.ts ]; then
  echo "✅ Found: src/app/sitemap.ts"
  SITEMAP=src/app/sitemap.ts
elif [ -f src/app/sitemap.xml/route.ts ]; then
  echo "✅ Found: src/app/sitemap.xml/route.ts"
  SITEMAP=src/app/sitemap.xml/route.ts
elif [ -f src/app/sitemap/route.ts ]; then
  echo "✅ Found: src/app/sitemap/route.ts"
  SITEMAP=src/app/sitemap/route.ts
else
  echo "Creating src/app/sitemap.ts"
  SITEMAP=src/app/sitemap.ts
fi

# ---------- make it dynamic ----------
if [ ! -f "$SITEMAP" ]; then
  cat > src/app/sitemap.ts << 'EOF'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

type SitemapEntry = {
  url: string
  lastModified?: string
  changeFrequency?: string
  priority?: number
}

export default async function sitemap(): Promise<SitemapEntry[]> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'

  const entries: SitemapEntry[] = [
    { url: base, priority: 1.0, changeFrequency: 'daily' },
    { url: base + '/explore', priority: 0.9, changeFrequency: 'hourly' },
    { url: base + '/prompts', priority: 0.9, changeFrequency: 'hourly' },
    { url: base + '/categories', priority: 0.8, changeFrequency: 'weekly' },
    { url: base + '/blog', priority: 0.8, changeFrequency: 'daily' },
    { url: base + '/submit', priority: 0.7, changeFrequency: 'monthly' },
  ]

  try {
    const [prompts, categories, articles] = await Promise.all([
      prisma.prompt.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true } }),
      prisma.category.findMany({ select: { slug: true } }),
      prisma.article.findMany({ select: { slug: true, createdAt: true } }),
    ])

    for (const p of prompts) {
      entries.push({
        url: base + '/prompts/' + p.slug,
        lastModified: new Date(p.updatedAt).toISOString(),
        priority: 0.8,
        changeFrequency: 'weekly',
      })
    }
    for (const c of categories) {
      entries.push({
        url: base + '/categories/' + c.slug,
        priority: 0.7,
        changeFrequency: 'weekly',
      })
    }
    for (const a of articles) {
      entries.push({
        url: base + '/blog/' + a.slug,
        lastModified: new Date(a.createdAt).toISOString(),
        priority: 0.7,
        changeFrequency: 'monthly',
      })
    }
  } catch {}

  return entries
}
EOF
else
  node << 'NODEEOF'
const fs = require('fs')
const p = process.env.SITEMAP || 'src/app/sitemap.ts'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('dynamic')) {
  s = s.replace(/export /, "export const dynamic = 'force-dynamic'\nexport const revalidate = 3600\nexport ")
  fs.writeFileSync(p, s)
  console.log('✅ sitemap: dynamic + revalidate added')
} else console.log('⚠️ sitemap already has dynamic')
NODEEOF
fi

echo "✅ update71-fix done!"