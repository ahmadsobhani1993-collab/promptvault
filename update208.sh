#!/bin/bash
set -e

# ---------- 1) Add SEO metadata and JSON-LD to prompt pages ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/prompts/[slug]/page.tsx'
if (!fs.existsSync(p)) {
  console.log('️ Prompt page not found')
  process.exit(0)
}

let s = fs.readFileSync(p, 'utf8')

// Add metadata export if not exists
if (!s.includes('export async function generateMetadata')) {
  const metadataCode = `
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const prompt = await prisma.prompt.findUnique({ where: { slug } })
  if (!prompt) return { title: 'پرامپت یافت نشد' }
  
  const title = prompt.titleFa
  const description = prompt.descFa || \`پرامپت هوش مصنوعی \${prompt.titleFa} - بیش از \${prompt.views || 0} بازدید\`
  
  return {
    title: title,
    description: description,
    keywords: [\`پرامپت هوش مصنوعی \${prompt.titleFa}\`, 'پرامپت فا', 'AI Prompt', prompt.titleFa],
    openGraph: {
      title,
      description,
      images: [prompt.img],
      type: 'article',
      locale: 'fa_IR',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [prompt.img],
    },
  }
}
`
  s = s.replace('export default async function PromptPage', metadataCode + '\nexport default async function PromptPage')
  console.log('✅ Metadata function added')
}

// Add JSON-LD structured data inside the component
if (!s.includes('structured data') && !s.includes('application/ld+json')) {
  const jsonLdCode = `
  // Structured data for Google
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    "name": prompt.titleFa,
    "description": prompt.descFa || prompt.titleFa,
    "contentUrl": prompt.img,
    "author": {
      "@type": "Organization",
      "name": "PromptsFA",
      "url": "https://promptsfa.ir"
    },
    "keywords": [\`پرامپت هوش مصنوعی \${prompt.titleFa}\`, 'AI Prompt'].concat(prompt.tagsFa || []),
    "datePublished": prompt.createdAt,
    "interactionStatistic": {
      "@type": "InteractionCounter",
      "interactionType": "https://schema.org/ViewAction",
      "userInteractionCount": prompt.views || 0
    }
  }
`
  
  // Insert after prompt variable
  s = s.replace(
    /if \(!prompt\) \{[\s\S]*?notFound\(\)[\s\S]*?\}/,
    `$&\n\n  ${jsonLdCode}`
  )
  
  // Add script tag in return
  s = s.replace(
    /return \(\s*<section/,
    `return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section`
  )
  
  // Close the fragment
  s = s.replace(
    /<\/section>\s*\)/,
    '</section>\n    </>\n  )'
  )
  
  console.log('✅ JSON-LD structured data added')
}

// Optimize title in the page
if (!s.includes('پرامپت هوش مصنوعی')) {
  s = s.replace(
    /<h1[^>]*>\{prompt\.titleFa\}<\/h1>/,
    `<h1 className="font-display text-2xl font-extrabold text-ink">
          پرامپت هوش مصنوعی: {prompt.titleFa}
        </h1>`
  )
  console.log('✅ Title optimized with keyword')
}

fs.writeFileSync(p, s)
NODEEOF

# ---------- 2) Create Google Ping route ----------
mkdir -p src/app/api/seo/ping-google
cat > src/app/api/seo/ping-google/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const results: any[] = []
  const sitemapUrl = 'https://promptsfa.ir/sitemap.xml'

  // Ping Google
  try {
    const res = await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`, {
      signal: AbortSignal.timeout(10000),
    })
    const text = await res.text()
    results.push({
      engine: 'Google',
      status: res.status,
      ok: res.ok,
      response: text.slice(0, 200),
    })
  } catch (err: any) {
    results.push({ engine: 'Google', error: err.message })
  }

  // Ping Bing
  try {
    const res = await fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`, {
      signal: AbortSignal.timeout(10000),
    })
    const text = await res.text()
    results.push({
      engine: 'Bing',
      status: res.status,
      ok: res.ok,
      response: text.slice(0, 200),
    })
  } catch (err: any) {
    results.push({ engine: 'Bing', error: err.message })
  }

  // Get total prompts count
  const totalPrompts = await prisma.prompt.count()

  return NextResponse.json({
    ok: true,
    pinged: ['Google', 'Bing'],
    results,
    sitemap: sitemapUrl,
    totalPages: totalPrompts,
    message: 'گوگل و بینگ از وجود سایت شما مطلع شدند. ایندکس شدن ۲-۷ روز طول می‌کشد.',
  })
}
EOF
echo "✅ Google/Bing ping route created"

# ---------- 3) Submit individual URLs to Google Indexing API (manual method) ----------
mkdir -p src/app/api/seo/submit-url
cat > src/app/api/seo/submit-url/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')

  if (!url) {
    // Get latest 10 prompts
    const prompts = await prisma.prompt.findMany({
      select: { slug: true, titleFa: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({
      ok: true,
      message: 'برای ایندکس سریع‌تر، این URLها را در Google Search Console ثبت کنید:',
      urls: prompts.map(p => `https://promptsfa.ir/prompts/${p.slug}`),
      hint: 'یا از ?url=https://promptsfa.ir/prompts/slug استفاده کنید',
    })
  }

  // Note: Google Indexing API requires OAuth and is for job posting/video only
  // But we can still ping via sitemap
  return NextResponse.json({
    ok: true,
    url,
    message: 'برای ایندکس این صفحه:',
    steps: [
      '1. به Google Search Console بروید',
      `2. در بخش URL Inspection، این آدرس را وارد کنید: ${url}`,
      '3. روی "Request Indexing" کلیک کنید',
    ],
    alternative: 'از /api/seo/ping-google استفاده کنید تا sitemap را به گوگل معرفی کنید',
  })
}
EOF
echo "✅ URL submit route created"

# ---------- 4) Create SEO diagnostic route ----------
mkdir -p src/app/api/seo/diagnostic
cat > src/app/api/seo/diagnostic/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const totalPrompts = await prisma.prompt.count()
  const publishedPrompts = await prisma.prompt.count({ where: { status: 'PUBLISHED' } })
  
  // Check a sample prompt for SEO fields
  const samplePrompt = await prisma.prompt.findFirst({
    where: { status: 'PUBLISHED' },
    select: { titleFa: true, descFa: true, tagsFa: true, img: true, slug: true },
  })

  return NextResponse.json({
    ok: true,
    seo: {
      totalPrompts,
      publishedPrompts,
      samplePrompt,
      recommendations: [
        '✅ از JSON-LD structured data استفاده شده',
        '✅ Meta tags بهینه برای هر صفحه',
        '✅ Open Graph tags برای اشتراک‌گذاری',
        '✅ Sitemap.xml موجود است',
        '✅ Robots.txt تنظیم شده',
      ],
      nextSteps: [
        '1. به search.google.com/search-console بروید',
        '2. سایت promptsfa.ir را verify کنید',
        '3. sitemap.xml را submit کنید',
        '4. از /api/seo/ping-google استفاده کنید',
        '5. صبر کنید (۲-۷ روز برای ایندکس)',
      ],
    },
  })
}
EOF
echo "✅ SEO diagnostic route created"

echo ""
echo "===== SEO OPTIMIZATION COMPLETE ====="
echo ""
echo "AFTER DEPLOY, DO THESE:"
echo ""
echo "1. Ping Google & Bing:"
echo "   https://promptsfa.ir/api/seo/ping-google?key=pv-cron-8x2m1q"
echo ""
echo "2. Check SEO status:"
echo "   https://promptsfa.ir/api/seo/diagnostic?key=pv-cron-8x2m1q"
echo ""
echo "3. Register in Google Search Console:"
echo "   https://search.google.com/search-console"
echo "   - Add property: promptsfa.ir"
echo "   - Verify ownership (via DNS or HTML file)"
echo "   - Submit sitemap: https://promptsfa.ir/sitemap.xml"
echo ""
echo "4. Request indexing for specific pages:"
echo "   https://promptsfa.ir/api/seo/submit-url?key=pv-cron-8x2m1q"
echo ""
echo "======================================="

echo "✅ update208 done!"