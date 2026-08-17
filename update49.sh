#!/bin/bash
set -e

# ---------- 1) vercel.json (دوباره، قطعی) ----------
cat > vercel.json << 'EOF'
{
  "crons": [
    {
      "path": "/api/cron/telegram",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/article",
      "schedule": "30 5 * * *"
    }
  ]
}
EOF

# ---------- 2) article route exists? ----------
if [ ! -f src/app/api/cron/article/route.ts ]; then
  echo "❌ article route missing! run update48.sh first, then this script again."
  exit 1
fi
echo "✅ article route exists"

# ---------- 3) Mobile menu component ----------
cat > src/components/mobile-menu.tsx << 'EOF'
'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function MobileMenu({
  links,
  admin,
}: {
  links: { href: string; label: string }[]
  admin: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative lg:hidden">
      <button type="button" onClick={() => setOpen(!open)} className="btn-secondary px-3 py-1.5" aria-label="منو">
        ☰
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-50 w-64 rounded-2xl border border-line bg-[#0a0805] p-5 shadow-2xl">
          <div className="grid gap-4">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
                {l.label}
              </Link>
            ))}
            {admin && (
              <Link href="/admin" onClick={() => setOpen(false)} className="text-sm font-bold text-gold-bright">
                🛠 مدیریت
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
EOF

# ---------- 4) Header with mobile menu ----------
cat > src/components/layout/header.tsx << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { type Locale } from '@/lib/i18n'
import { getCategories, L } from '@/lib/data'
import LocaleSwitcher from '@/components/locale-switcher'
import MobileMenu from '@/components/mobile-menu'

export default async function Header() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const session = await auth()
  const categories = await getCategories()
  const isAdmin = session?.user?.role === 'ADMIN'

  const mobileLinks = [
    { href: '/explore', label: L(locale, 'کاوش', 'Explore') },
    { href: '/prompts', label: L(locale, 'پرامپت‌ها', 'Prompts') },
    { href: '/categories', label: L(locale, 'دسته‌بندی‌ها', 'Categories') },
    { href: '/blog', label: L(locale, 'وبلاگ', 'Blog') },
    { href: '/submit', label: L(locale, 'ارسال پرامپت', 'Submit') },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-[#070503]/85 backdrop-blur">
      <div className="container-app flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MobileMenu links={mobileLinks} admin={!!isAdmin} />
          <Link href="/" className="font-display text-lg font-extrabold tracking-tight">
            Prompts<span className="text-gold-bright">FA</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 text-sm text-ink-muted lg:flex">
          <Link href="/explore" className="transition-colors hover:text-gold-bright">{L(locale, 'کاوش', 'Explore')}</Link>

          <div className="group relative">
            <button type="button" className="transition-colors hover:text-gold-bright">
              {L(locale, 'دسته‌بندی‌ها', 'Categories')} ▾
            </button>
            <div className="invisible absolute left-1/2 top-full z-50 w-80 -translate-x-1/2 pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
              <div className="card max-h-[70vh] overflow-auto p-4">
                {categories.map((c) => (
                  <div key={c.id} className="mb-4 last:mb-0">
                    <Link href={'/categories/' + c.slug} className="block rounded-lg px-3 py-1.5 text-sm font-bold text-ink transition-colors hover:bg-elevated hover:text-gold-bright">
                      {c.icon} {L(locale, c.nameFa, c.nameEn)}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-1.5 px-3">
                      {c.subs.map((s) => (
                        <Link key={s.id} href={'/categories/' + c.slug + '?sub=' + s.slug} className="rounded-full border border-line bg-elevated px-2.5 py-1 text-[10px] text-ink-muted transition-colors hover:border-gold/50 hover:text-gold-bright">
                          {L(locale, s.fa, s.en)}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Link href="/blog" className="transition-colors hover:text-gold-bright">{L(locale, 'وبلاگ', 'Blog')}</Link>
          <Link href="/submit" className="transition-colors hover:text-gold-bright">{L(locale, 'ارسال پرامپت', 'Submit')}</Link>
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          {session?.user ? (
            <>
              {isAdmin && (
                <Link href="/admin" className="btn-secondary hidden lg:inline-flex">🛠 {L(locale, 'مدیریت', 'Admin')}</Link>
              )}
              <Link href="/submit" className="btn-primary hidden sm:inline-flex">+ {L(locale, 'ارسال', 'Submit')}</Link>
            </>
          ) : (
            <Link href="/login" className="btn-primary">{L(locale, 'ورود', 'Login')}</Link>
          )}
        </div>
      </div>
    </header>
  )
}
EOF

# ---------- 5) Share buttons on detail page (robust) ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/prompts/[slug]/page.tsx'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('ShareButtons')) {
  s = s.replace(
    "import PromptReveal from '@/components/prompt-reveal'",
    "import PromptReveal from '@/components/prompt-reveal'\nimport ShareButtons from '@/components/share-buttons'"
  )
  const anchor = '<div className="mt-5 flex flex-wrap gap-1">'
  if (s.includes(anchor)) {
    s = s.replace(
      anchor,
      `<div className="mt-5">
            <ShareButtons
              title={L(locale, item.titleFa, item.titleEn)}
              desc={L(locale, item.descFa ?? '', item.descEn ?? '')}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-1">`
    )
    console.log('✅ detail: share buttons inserted')
  } else {
    console.log('❌ detail: anchor not found')
  }
  fs.writeFileSync(p, s)
} else {
  console.log('⚠️ share buttons already present')
}
NODEEOF

echo ""
echo "✅ ALL FIXED! حالا حتماً این سه دستور را بزن:"
echo ""
echo "   git add ."
echo "   git commit -m 'mobile menu + share + crons'"
echo "   git push"