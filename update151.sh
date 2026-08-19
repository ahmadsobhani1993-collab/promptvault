#!/bin/bash
set -e

# ---------- 1) Limit articles to 6 on homepage ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/page.tsx'
let s = fs.readFileSync(p, 'utf8')

// Change getArticles() to only take 6
s = s.replace(
  'getArticles()',
  'getArticles({ take: 6 })'
)

fs.writeFileSync(p, s)
console.log('✅ Homepage: limited to 6 articles')
NODEEOF

# ---------- 2) Update getArticles function to accept take parameter ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/data.ts'
let s = fs.readFileSync(p, 'utf8')

// Add take parameter to getArticles
if (!s.includes('getArticles({ take')) {
  s = s.replace(
    /export async function getArticles\(\)/,
    'export async function getArticles(opts?: { take?: number })'
  )
  s = s.replace(
    /prisma\.article\.findMany\(\{/g,
    'prisma.article.findMany({ take: opts?.take ?? 50, '
  )
  fs.writeFileSync(p, s)
  console.log('✅ getArticles: added take parameter')
} else {
  console.log('⚠️ Already has take parameter')
}
NODEEOF

# ---------- 3) Fix header: add submit button back ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/header.tsx'
let s = fs.readFileSync(p, 'utf8')

// Add submit/logout buttons if not exists
if (!s.includes('/submit') && !s.includes('/logout')) {
  s = s.replace(
    /(<\/div>\s*<\/div>\s*<\/header>)/,
    `<div className="hidden items-center gap-2 lg:flex">
            {session?.user ? (
              <Link href="/api/auth/signout" className="btn-secondary text-xs">
                {L(locale, 'خروج', 'Logout')}
              </Link>
            ) : (
              <Link href="/submit" className="btn-primary text-xs">
                {L(locale, 'ارسال', 'Submit')}
              </Link>
            )}
          </div>
          </div>
        </div>
      </header>`
  )
  fs.writeFileSync(p, s)
  console.log('✅ Header: submit/logout buttons added')
} else {
  console.log('⚠️ Buttons already exist')
}
NODEEOF

# ---------- 4) Fix account page queries ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/account/page.tsx'
let s = fs.readFileSync(p, 'utf8')

// Check schema for relation field names
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8')
const likeModel = schema.match(/model Like \{([\s\S]*?)\n\}/)
const bookmarkModel = schema.match(/model Bookmark \{([\s\S]*?)\n\}/)

let userIdField = 'userId'
if (likeModel) {
  const fields = likeModel[1]
  if (fields.includes('userId')) userIdField = 'userId'
  else if (fields.includes('user')) userIdField = 'user'
}

console.log('Using userId field:', userIdField)

// Fix likes query
s = s.replace(
  /where: \{ user: \{ email: userEmail \} \}/g,
  `where: { ${userIdField}: session.user.id }`
)

// Fix bookmarks query  
s = s.replace(
  /where: \{ user: \{ email: userEmail \} \}/g,
  `where: { ${userIdField}: session.user.id }`
)

// Fix comments query
s = s.replace(
  /where: \{ user: \{ email: userEmail \} \}/g,
  `where: { ${userIdField}: session.user.id }`
)

// Fix prompts query
s = s.replace(
  /where: \{ user: \{ email: userEmail \} \}/g,
  `where: { ${userIdField}: session.user.id }`
)

fs.writeFileSync(p, s)
console.log('✅ Account page: queries fixed to use userId')
NODEEOF

# ---------- 5) Create footer with PWA button ----------
cat > src/components/layout/footer.tsx << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { L, type Locale } from '@/lib/data'

export default async function Footer() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  return (
    <footer className="border-t border-line/70 bg-[#0a0805]">
      <div className="container-app py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="font-display text-lg font-extrabold text-gold-bright">PromptsFA</h3>
            <p className="mt-3 text-sm text-ink-muted">
              {L(locale, 'هزاران پرامپت حرفه‌ای هوش مصنوعی به فارسی', 'Thousands of professional AI prompts in Persian')}
            </p>
          </div>
          <div>
            <h4 className="font-display text-sm font-bold text-ink">
              {L(locale, 'لینک‌های سریع', 'Quick Links')}
            </h4>
            <nav className="mt-3 flex flex-col gap-2 text-sm text-ink-muted">
              <Link href="/explore" className="transition-colors hover:text-gold-bright">
                {L(locale, 'کاوش', 'Explore')}
              </Link>
              <Link href="/categories" className="transition-colors hover:text-gold-bright">
                {L(locale, 'دسته‌بندی‌ها', 'Categories')}
              </Link>
              <Link href="/blog" className="transition-colors hover:text-gold-bright">
                {L(locale, 'وبلاگ', 'Blog')}
              </Link>
            </nav>
          </div>
          <div>
            <h4 className="font-display text-sm font-bold text-ink">
              {L(locale, 'نصب اپلیکیشن', 'Install App')}
            </h4>
            <p className="mt-3 text-sm text-ink-muted">
              {L(locale, 'برای دسترسی سریع‌تر، اپلیکیشن ما را نصب کنید', 'Install our app for faster access')}
            </p>
            <button
              onClick={() => {
                alert('📲 برای نصب:\n\n• Chrome موبایل: منوی سه‌نقطه → "Add to Home Screen"\n• Safari iOS: Share → "Add to Home Screen"\n• Chrome دسکتاپ: آیکون install در نوار آدرس')
              }}
              className="mt-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold text-black shadow-lg transition-all hover:scale-110"
              title={L(locale, 'نصب اپلیکیشن', 'Install App')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
        <div className="mt-8 border-t border-line/60 pt-6 text-center text-xs text-ink-faint">
          © {new Date().getFullYear()} PromptsFA.ir - {L(locale, 'تمامی حقوق محفوظ است', 'All rights reserved')}
        </div>
      </div>
    </footer>
  )
}
EOF
echo "✅ Footer created with PWA button"

# ---------- 6) Mount footer in layout ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/layout.tsx'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes("import Footer from '@/components/layout/footer'")) {
  s = s.replace(
    "import RouteLoader from '@/components/route-loader'",
    "import RouteLoader from '@/components/route-loader'\nimport Footer from '@/components/layout/footer'"
  )
  s = s.replace(/(<RouteLoader \/>)/, '$1\n        <Footer />')
  fs.writeFileSync(p, s)
  console.log('✅ Footer mounted in layout')
} else {
  console.log('⚠️ Footer already mounted')
}
NODEEOF

echo "✅ update151 done!"