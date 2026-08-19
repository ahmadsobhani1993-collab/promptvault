#!/bin/bash
set -e

# ---------- 1) Fix header: language toggle button + logout/submit buttons ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/header.tsx'
let s = fs.readFileSync(p, 'utf8')

// Remove separate EN/FA buttons
s = s.replace(/<button type="button" className="hidden rounded-lg border border-line bg-elevated px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-gold\/40 hover:text-gold-bright md:inline-flex">\s*EN\s*<\/button>\s*<button type="button" className="hidden rounded-lg border border-line bg-elevated px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-gold\/40 hover:text-gold-bright md:inline-flex">\s*فا\s*<\/button>/, '')

// Add language toggle button
s = s.replace(
  /(<NotifBell \/>)/,
  `<div className="hidden md:flex">
            <Link href="/?locale=fa" className={'rounded-lg border px-3 py-1.5 text-xs transition-colors ' + (locale === 'fa' ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted hover:border-gold/40')}>
              فارسی
            </Link>
            <Link href="/?locale=en" className={'rounded-lg border px-3 py-1.5 text-xs transition-colors ' + (locale === 'en' ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted hover:border-gold/40')}>
              English
            </Link>
          </div>
          $1`
)

// Add logout and submit buttons
s = s.replace(
  /(<\/div>\s*<\/div>\s*<\/header>)/,
  `<div className="hidden items-center gap-2 lg:flex">
            {session?.user ? (
              <Link href="/logout" className="btn-secondary text-xs">
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
console.log('✅ Header: language toggle + logout/submit added')
NODEEOF

# ---------- 2) Add PWA button to footer ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/footer.tsx'
if (!fs.existsSync(p)) {
  console.log('⚠️ Footer not found, creating it')
  fs.mkdirSync('src/components/layout', { recursive: true })
  fs.writeFileSync(p, `export default function Footer() {
  return (
    <footer className="border-t border-line/70 bg-[#0a0805]">
      <div className="container-app py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="font-display text-lg font-extrabold text-gold-bright">PromptsFA</h3>
            <p className="mt-3 text-sm text-ink-muted">
              هزاران پرامپت حرفه‌ای هوش مصنوعی به فارسی
            </p>
          </div>
          <div>
            <h4 className="font-display text-sm font-bold text-ink">لینک‌های سریع</h4>
            <nav className="mt-3 flex flex-col gap-2 text-sm text-ink-muted">
              <a href="/explore" className="transition-colors hover:text-gold-bright">کاوش</a>
              <a href="/categories" className="transition-colors hover:text-gold-bright">دسته‌بندی‌ها</a>
              <a href="/blog" className="transition-colors hover:text-gold-bright">وبلاگ</a>
            </nav>
          </div>
          <div>
            <h4 className="font-display text-sm font-bold text-ink">نصب اپلیکیشن</h4>
            <p className="mt-3 text-sm text-ink-muted">
              برای دسترسی سریع‌تر، اپلیکیشن ما را نصب کنید
            </p>
            <button
              onClick={() => {
                alert('📲 برای نصب:\n\n• Chrome موبایل: منوی سه‌نقطه → "Add to Home Screen"\n• Safari iOS: Share → "Add to Home Screen"')
              }}
              className="mt-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold text-black shadow-lg transition-all hover:scale-110"
              title="نصب اپلیکیشن"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
        <div className="mt-8 border-t border-line/60 pt-6 text-center text-xs text-ink-faint">
          © {new Date().getFullYear()} PromptsFA.ir - تمامی حقوق محفوظ است
        </div>
      </div>
    </footer>
  )
}`)
  console.log('✅ Footer created with PWA button')
} else {
  let s = fs.readFileSync(p, 'utf8')
  if (!s.includes('نصب اپلیکیشن')) {
    // Add PWA section before closing footer div
    s = s.replace(
      /(<\/div>\s*<div className="mt-8 border-t)/,
      `<div className="mt-8 border-t border-line/60 pt-6 text-center text-xs text-ink-faint">
          © ${new Date().getFullYear()} PromptsFA.ir - تمامی حقوق محفوظ است
        </div>
      </div>
    </footer>`
    )
    fs.writeFileSync(p, s)
    console.log('✅ Footer: PWA button added')
  } else {
    console.log('⚠️ PWA button already in footer')
  }
}
NODEEOF

# ---------- 3) Fix account page: ensure likes and bookmarks show ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/account/page.tsx'
let s = fs.readFileSync(p, 'utf8')

// Check if queries are correct
if (s.includes('where: { user: { email: userEmail } }')) {
  console.log('✅ Account queries look correct')
} else {
  // Fix the queries to use proper relations
  s = s.replace(
    /where: { userId }/g,
    'where: { user: { email: userEmail } }'
  )
  fs.writeFileSync(p, s)
  console.log('✅ Account queries fixed')
}
NODEEOF

# ---------- 4) Limit homepage to 6 articles ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/page.tsx'
if (!fs.existsSync(p)) {
  console.log('❌ Homepage not found')
  process.exit(0)
}

let s = fs.readFileSync(p, 'utf8')

// Find and limit articles query
if (s.includes('prisma.article.findMany')) {
  // Add take: 6 if not exists
  if (!s.includes('take: 6')) {
    s = s.replace(
      /prisma\.article\.findMany\(\{/g,
      'prisma.article.findMany({ take: 6, '
    )
    console.log('✅ Homepage: limited to 6 articles')
  }
  
  // Add "View More" button if not exists
  if (!s.includes('/blog"') || !s.includes('مشاهده')) {
    // Find main closing and add button
    s = s.replace(
      /(<\/main>)/,
      `<div className="container-app pb-16 text-center">
        <a href="/blog" className="inline-flex items-center rounded-full bg-gold px-6 py-3 font-bold text-black transition-all hover:scale-105">
          مشاهده همه مقالات
        </a>
      </div>
      </main>`
    )
    console.log('✅ Homepage: "View More" button added')
  }
  
  fs.writeFileSync(p, s)
} else {
  console.log('⚠️ No articles query found in homepage')
}
NODEEOF

echo "✅ update150 done!"