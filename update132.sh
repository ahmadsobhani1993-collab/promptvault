#!/bin/bash
set -e

# ---------- 1) JSON-LD structured data for homepage ----------
cat > src/components/json-ld.tsx << 'EOF'
export default function JsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "PromptsFA",
    "url": "https://promptsfa.ir",
    "description": "هزاران پرامپت حرفه‌ای هوش مصنوعی به فارسی",
    "inLanguage": "fa-IR",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://promptsfa.ir/explore?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
EOF

# Mount in layout
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/layout.tsx'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('JsonLd')) {
  s = s.replace(
    "import Footer from '@/components/layout/footer'",
    "import Footer from '@/components/layout/footer'\nimport JsonLd from '@/components/json-ld'"
  )
  s = s.replace('<RouteLoader />', '<RouteLoader />\n        <JsonLd />')
  fs.writeFileSync(p, s)
  console.log('✅ JsonLd mounted')
} else console.log('️ already')
NODEEOF

# ---------- 2) Blog post JSON-LD ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/blog/[slug]/page.tsx'
if (!fs.existsSync(p)) { console.log('⚠️ no blog page'); process.exit(0) }
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('ArticleJsonLd')) {
  const jsonld = `
function ArticleJsonLd({ article }: { article: any }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.titleFa,
    "description": article.descFa,
    "image": article.img,
    "datePublished": article.createdAt,
    "dateModified": article.createdAt,
    "author": { "@type": "Organization", "name": "PromptsFA" },
    "publisher": { "@type": "Organization", "name": "PromptsFA", "url": "https://promptsfa.ir" },
    "mainEntityOfPage": { "@type": "WebPage", "@id": "https://promptsfa.ir/blog/" + article.slug }
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}
`
  s = s.replace('export default', jsonld + '\nexport default')
  s = s.replace(/return \(\n\s*<section/, 'return (\n    <>\n      <ArticleJsonLd article={' + (s.match(/const (\w+) = await prisma\.article/)?.[1] || 'article') + '} />\n      <section')
  s = s.replace(/<\/section>\n\s*\)/, '</section>\n    </>\n  )')
  fs.writeFileSync(p, s)
  console.log('✅ Article JSON-LD added')
} else console.log('⚠️ already')
NODEEOF

# ---------- 3) Ping Google sitemap route ----------
mkdir -p src/app/api/debug/ping-google
cat > src/app/api/debug/ping-google/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const results: any[] = []
  
  // Google
  try {
    const r = await fetch('https://www.google.com/ping?sitemap=https://promptsfa.ir/sitemap.xml', { signal: AbortSignal.timeout(10000) })
    results.push({ engine: 'google', status: r.status, ok: r.ok })
  } catch (e: any) { results.push({ engine: 'google', error: e.message }) }

  // Bing
  try {
    const r = await fetch('https://www.bing.com/ping?sitemap=https://promptsfa.ir/sitemap.xml', { signal: AbortSignal.timeout(10000) })
    results.push({ engine: 'bing', status: r.status, ok: r.ok })
  } catch (e: any) { results.push({ engine: 'bing', error: e.message }) }

  return NextResponse.json({ ok: true, results })
}
EOF
echo "✅ ping-google route"

# ---------- 4) Robots.txt: add host ----------
cat > public/robots.txt << 'EOF'
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
Disallow: /login
Disallow: /submit

Host: https://promptsfa.ir
Sitemap: https://promptsfa.ir/sitemap.xml
EOF
echo "✅ robots.txt updated"

# ---------- 5) Canonical URL helper ----------
cat > src/components/canonical.tsx << 'EOF'
export default function Canonical({ path }: { path: string }) {
  return <link rel="canonical" href={'https://promptsfa.ir' + path} />
}
EOF
echo "✅ canonical component"

echo "✅ update132 done!"