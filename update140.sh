#!/bin/bash
set -e

# ---------- 1) Fix account page: ensure likes and bookmarks work ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/account/page.tsx'
let s = fs.readFileSync(p, 'utf8')

// Check if Bookmark and Like models exist in schema
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8')
const hasBookmark = schema.includes('model Bookmark')
const hasLike = schema.includes('model Like')

console.log('Schema check - Bookmark:', hasBookmark, 'Like:', hasLike)

// If models don't exist, simplify the page
if (!hasBookmark || !hasLike) {
  s = s.replace(
    /\/\/ Try to get likes \(might not exist\)[\s\S]*?console\.log\('Likes not available'\)/,
    'const likedPrompts = []'
  )
  s = s.replace(
    /\/\/ Try to get bookmarks \(might not exist\)[\s\S]*?console\.log\('Bookmarks not available'\)/,
    'const savedPrompts = []'
  )
  fs.writeFileSync(p, s)
  console.log('✅ Account page: simplified (models missing)')
} else {
  console.log('⚠️ Models exist, queries should work')
}
NODEEOF

# ---------- 2) Add account link to mobile menu ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/header.tsx'
let s = fs.readFileSync(p, 'utf8')

// Find MobileMenu component and add account link
if (s.includes('MobileMenu')) {
  // Add account link before logout in mobile menu
  if (!s.includes('href="/account"') || !s.includes('MobileMenu')) {
    // Find the mobile menu section and add account
    const mobileMenuPattern = /(\{isAdmin \&\& \([\s\S]*?<\/div>\s*\)\})/
    if (mobileMenuPattern.test(s)) {
      s = s.replace(
        mobileMenuPattern,
        `$1\n          <Link href="/account" className="rounded-xl border border-line bg-elevated px-4 py-2.5 text-sm text-ink-muted transition-colors hover:border-gold/50 hover:text-gold-bright">\n            👤 {L(locale, 'حساب', 'Account')}\n          </Link>`
      )
      fs.writeFileSync(p, s)
      console.log('✅ Header: account link added to mobile menu')
    } else {
      console.log('⚠️ Could not find mobile menu pattern')
    }
  } else {
    console.log('⚠️ Account link already exists')
  }
} else {
  console.log('⚠️ MobileMenu not found in header')
}
NODEEOF

# ---------- 3) Homepage: limit to 6 articles with "View More" ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/page.tsx'
if (!fs.existsSync(p)) {
  console.log('️ Homepage not found')
  process.exit(0)
}

let s = fs.readFileSync(p, 'utf8')

// Find articles query and limit to 6
if (s.includes('prisma.article.findMany')) {
  // Add take: 6 if not exists
  if (!s.includes('take: 6')) {
    s = s.replace(
      /prisma\.article\.findMany\(\{[\s\S]*?orderBy: \{ createdAt: 'desc' \}/,
      (match) => match.replace("orderBy: { createdAt: 'desc' }", "orderBy: { createdAt: 'desc' }, take: 6")
    )
    console.log('✅ Homepage: limited to 6 articles')
  }
  
  // Add "View More" button after articles section
  if (!s.includes('/blog"') || !s.includes('مشاهده همه')) {
    // Find the articles section closing and add button
    s = s.replace(
      /(<\/section>\s*<\/main>)/,
      `<div className="container-app pb-16 text-center">
          <Link href="/blog" className="btn-primary inline-flex">
            مشاهده همه مقالات
          </Link>
        </div>
        </section>
        </main>`
    )
    console.log('✅ Homepage: "View More" button added')
  }
  
  fs.writeFileSync(p, s)
} else {
  console.log('⚠️ No articles query found')
}
NODEEOF

# ---------- 4) Ensure PWA button is rendered ----------
node << 'NODEEOF'
const fs = require('fs')

// Check if PWAControls is mounted in layout
const layout = fs.readFileSync('src/app/layout.tsx', 'utf8')
if (!layout.includes('PWAControls')) {
  let s = layout
  s = s.replace(
    "import Footer from '@/components/layout/footer'",
    "import Footer from '@/components/layout/footer'\nimport PWAControls from '@/components/pwa-controls'"
  )
  s = s.replace('<RouteLoader />', '<RouteLoader />\n        <PWAControls />')
  fs.writeFileSync('src/app/layout.tsx', s)
  console.log('✅ PWAControls mounted in layout')
} else {
  console.log('⚠️ PWAControls already mounted')
}

// Check if component file exists
if (fs.existsSync('src/components/pwa-controls.tsx')) {
  console.log('✅ PWA component exists')
} else {
  console.log('❌ PWA component missing')
}
NODEEOF

echo "✅ update140 done!"