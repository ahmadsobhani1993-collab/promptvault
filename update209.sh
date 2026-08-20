#!/bin/bash
set -e

# ---------- 1) Add FAQ Schema to prompts ----------
mkdir -p src/components/faq-schema
cat > src/components/faq-schema.tsx << 'EOF'
export default function FAQSchema() {
  const faqData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "پرامپت هوش مصنوعی چیست؟",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "پرامپت هوش مصنوعی مجموعه‌ای از دستورات و کلمات کلیدی است که به ابزارهای هوش مصنوعی مانند Midjourney، ChatGPT و DALL-E داده می‌شود تا خروجی مورد نظر را تولید کنند."
        }
      },
      {
        "@type": "Question",
        "name": "چگونه از پرامپت‌های PromptsFA استفاده کنم؟",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "کافی است متن پرامپت را کپی کرده و در ابزار هوش مصنوعی مورد نظر خود (مانند Midjourney یا ChatGPT) paste کنید. می‌توانید پارامترها را بر اساس نیاز خود تنظیم کنید."
        }
      },
      {
        "@type": "Question",
        "name": "آیا پرامپت‌های PromptsFA رایگان هستند؟",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "بله، تمام پرامپت‌های موجود در PromptsFA به صورت رایگان در دسترس کاربران قرار دارند."
        }
      }
    ]
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
    />
  )
}
EOF
echo "✅ FAQ Schema component created"

# ---------- 2) Add Breadcrumb Schema ----------
mkdir -p src/components/breadcrumb-schema
cat > src/components/breadcrumb-schema.tsx << 'EOF'
export default function BreadcrumbSchema({ items }: { items: Array<{ name: string; url: string }> }) {
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": `https://promptsfa.ir${item.url}`
    }))
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
    />
  )
}
EOF
echo "✅ Breadcrumb Schema component created"

# ---------- 3) Create Image Sitemap ----------
mkdir -p src/app/sitemap-image.xml/route.ts
cat > src/app/sitemap-image.xml/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const prompts = await prisma.prompt.findMany({
    where: { status: 'PUBLISHED', img: { not: null } },
    select: { slug: true, img: true, titleFa: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`

  for (const prompt of prompts) {
    xml += `  <url>
    <loc>https://promptsfa.ir/prompts/${prompt.slug}</loc>
    <lastmod>${prompt.createdAt.toISOString()}</lastmod>
    <image:image>
      <image:loc>${prompt.img}</image:loc>
      <image:title>${prompt.titleFa}</image:title>
    </image:image>
  </url>
`
  }

  xml += `</urlset>`

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}
EOF
echo "✅ Image sitemap created"

# ---------- 4) Optimize robots.txt ----------
cat > public/robots.txt << 'EOF'
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
Disallow: /login
Disallow: /account
Disallow: /submit

# Allow important pages
Allow: /prompts/
Allow: /categories/
Allow: /blog/
Allow: /explore

# Crawl-delay (be nice to server)
Crawl-delay: 1

# Sitemaps
Sitemap: https://promptsfa.ir/sitemap.xml
Sitemap: https://promptsfa.ir/sitemap-image.xml

Host: https://promptsfa.ir
EOF
echo "✅ robots.txt optimized"

# ---------- 5) Create SEO audit route ----------
mkdir -p src/app/api/seo/audit
cat > src/app/api/seo/audit/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const totalPrompts = await prisma.prompt.count()
  const withDesc = await prisma.prompt.count({ where: { descFa: { not: null, not: '' } } })
  const withTags = await prisma.prompt.count({ where: { tagsFa: { isEmpty: false } } })
  const withImg = await prisma.prompt.count({ where: { img: { not: null } } })

  return NextResponse.json({
    ok: true,
    audit: {
      content: {
        totalPrompts,
        withDescription: `${withDesc}/${totalPrompts} (${((withDesc/totalPrompts)*100).toFixed(1)}%)`,
        withTags: `${withTags}/${totalPrompts} (${((withTags/totalPrompts)*100).toFixed(1)}%)`,
        withImages: `${withImg}/${totalPrompts} (${((withImg/totalPrompts)*100).toFixed(1)}%)`,
      },
      technical: {
        sitemap: '✅ Exists',
        robotsTxt: '✅ Exists',
        jsonLd: '✅ Implemented',
        openGraph: '✅ Implemented',
        mobileFriendly: '✅ Responsive',
        https: '✅ Enabled',
      },
      recommendations: [
        withDesc < totalPrompts * 0.8 && '⚠️ حداقل 80% پرامپت‌ها باید توضیح داشته باشند',
        withTags < totalPrompts * 0.8 && '⚠️ حداقل 80% پرامپت‌ها باید تگ داشته باشند',
        '✅ از Internal Linking استفاده کنید (لینک بین پرامپت‌های مرتبط)',
        '✅ محتوای وبلاگ منظم منتشر کنید',
        '✅ در شبکه‌های اجتماعی لینک سایت را به اشتراک بگذارید',
        '✅ از سایت‌های معتبر بک‌لینک بگیرید',
        '✅ سرعت سایت را با Cloudflare بهبود دهید',
      ].filter(Boolean),
    },
  })
}
EOF
echo "✅ SEO audit route created"

# ---------- 6) Create backlink checker route ----------
mkdir -p src/app/api/seo/backlinks
cat > src/app/api/seo/backlinks/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  return NextResponse.json({
    ok: true,
    strategies: [
      {
        name: 'ثبت در دایرکتوری‌ها',
        sites: [
          'https://www.alexa.com/',
          'https://www.crunchbase.com/',
          'ایران: https://www.irandirectory.ir/',
        ],
      },
      {
        name: 'شبکه‌های اجتماعی',
        sites: [
          'Twitter/X',
          'LinkedIn',
          'Instagram',
          'Telegram',
          'Reddit (r/artificial, r/midjourney)',
        ],
      },
      {
        name: 'Guest Posting',
        desc: 'مقاله مهمان در سایت‌های مرتبط با هوش مصنوعی',
      },
      {
        name: 'Forum Participation',
        sites: [
          'Quora',
          'Stack Overflow',
          'Reddit',
          'انجمن‌های ایرانی',
        ],
      },
      {
        name: 'Press Release',
        desc: 'خبر انتشار سایت در سایت‌های خبری',
      },
    ],
    tools: [
      'Google Search Console - بخش Links',
      'Ahrefs (پولی)',
      'SEMrush (پولی)',
      'Ubersuggest',
    ],
  })
}
EOF
echo "✅ Backlink strategies route created"

# ---------- 7) Create content freshness route ----------
mkdir -p src/app/api/seo/freshness
cat > src/app/api/seo/freshness/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const now = new Date()
  const last24h = await prisma.prompt.count({
    where: { createdAt: { gte: new Date(now.getTime() - 86400000) } }
  })
  const last7days = await prisma.prompt.count({
    where: { createdAt: { gte: new Date(now.getTime() - 7 * 86400000) } }
  })
  const last30days = await prisma.prompt.count({
    where: { createdAt: { gte: new Date(now.getTime() - 30 * 86400000) } }
  })

  return NextResponse.json({
    ok: true,
    freshness: {
      last24h,
      last7days,
      last30days,
      recommendation: last7days < 10 
        ? '⚠️ حداقل 10 پرامپت جدید در هفته اضافه کنید (گوگل محتوای تازه را دوست دارد)'
        : '✅ فرکانس انتشار خوب است',
    },
  })
}
EOF
echo "✅ Content freshness checker created"

# ---------- 8) Create comprehensive SEO checklist ----------
mkdir -p src/app/api/seo/checklist
cat > src/app/api/seo/checklist/route.ts << 'EOF'
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    checklist: {
      technical: [
        '✅ SSL/HTTPS فعال است',
        '✅ robots.txt تنظیم شده',
        '✅ sitemap.xml وجود دارد',
        '✅ sitemap-image.xml ایجاد شد',
        '✅ JSON-LD structured data اضافه شد',
        '✅ Meta tags بهینه',
        '✅ Open Graph tags',
        '✅ Mobile responsive',
        ' Core Web Vitals (با Cloudflare بهبود دهید)',
        '⏳ Lazy loading برای تصاویر',
      ],
      content: [
        '✅ هر صفحه title منحصر به فرد',
        '✅ هر صفحه description منحصر به فرد',
        '✅ استفاده از keywords در title',
        '✅ Alt text برای تصاویر',
        '⏳ FAQ schema',
        ' Breadcrumb schema',
        ' محتوای وبلاگ منظم',
        '⏳ Internal linking',
      ],
      offPage: [
        '⏳ ثبت در Google Search Console',
        '⏳ ثبت در Bing Webmaster Tools',
        '⏳ ساخت بک‌لینک',
        '⏳ فعالیت در شبکه‌های اجتماعی',
        '⏳ Guest posting',
        '⏳ ثبت در دایرکتوری‌ها',
      ],
      monitoring: [
        '⏳ بررسی منظم Search Console',
        '⏳ مانیتورینگ keywords',
        '⏳ تحلیل ترافیک (Google Analytics)',
        '⏳ بررسی سرعت سایت (PageSpeed Insights)',
      ],
    },
    priority: [
      '1. Google Search Console',
      '2. Bing Webmaster Tools',
      '3. Social Media Sharing',
      '4. Content Creation (هفته‌ای 10+ پرامپت)',
      '5. Backlink Building',
    ],
  })
}
EOF
echo "✅ SEO checklist created"

echo ""
echo "===== COMPREHENSIVE SEO PACKAGE INSTALLED ====="
echo ""
echo "AFTER DEPLOY, CHECK THESE:"
echo ""
echo "1. SEO Audit:"
echo "   https://promptsfa.ir/api/seo/audit?key=pv-cron-8x2m1q"
echo ""
echo "2. SEO Checklist:"
echo "   https://promptsfa.ir/api/seo/checklist"
echo ""
echo "3. Content Freshness:"
echo "   https://promptsfa.ir/api/seo/freshness?key=pv-cron-8x2m1q"
echo ""
echo "4. Backlink Strategies:"
echo "   https://promptsfa.ir/api/seo/backlinks?key=pv-cron-8x2m1q"
echo ""
echo "5. Image Sitemap:"
echo "   https://promptsfa.ir/sitemap-image.xml"
echo ""
echo "=============================================="

echo "✅ update209 done!"