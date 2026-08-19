#!/bin/bash
set -e

# ---------- 1) Update MobileMenu to include logout/submit buttons ----------
cat > src/components/mobile-menu.tsx << 'EOF'
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export default function MobileMenu({
  links,
  admin,
  isLoggedIn,
}: {
  links: { href: string; label: string }[]
  admin: boolean
  isLoggedIn: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="relative lg:hidden" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} className="btn-secondary px-3 py-1.5" aria-label="منو">☰</button>
      {open && (
        <div className="fixed inset-x-3 top-20 z-50 rounded-2xl border border-line bg-[#0a0805] p-5 shadow-2xl">
          <div className="grid gap-4">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
                {l.label}
              </Link>
            ))}
            {admin && (
              <Link href="/admin" onClick={() => setOpen(false)} className="text-sm font-bold text-gold-bright">🛠 مدیریت</Link>
            )}
            
            {/* Logout / Submit buttons */}
            <div className="mt-2 flex gap-2 border-t border-line pt-4">
              {isLoggedIn ? (
                <Link href="/api/auth/signout" onClick={() => setOpen(false)} className="btn-secondary flex-1 text-center text-xs">
                  خروج
                </Link>
              ) : (
                <Link href="/submit" onClick={() => setOpen(false)} className="btn-primary flex-1 text-center text-xs">
                  ارسال پرامپت
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
EOF
echo "✅ MobileMenu: added logout/submit buttons"

# ---------- 2) Update header.tsx to pass isLoggedIn to MobileMenu ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/header.tsx'
let s = fs.readFileSync(p, 'utf8')

// Update MobileMenu usage to include isLoggedIn prop
s = s.replace(
  /<MobileMenu links=\{mobileLinks\} admin=\{\!\!isAdmin\} \/>/,
  '<MobileMenu links={mobileLinks} admin={!!isAdmin} isLoggedIn={!!session?.user} />'
)

fs.writeFileSync(p, s)
console.log('✅ Header: passed isLoggedIn to MobileMenu')
NODEEOF

# ---------- 3) Add debug logging to account page ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/account/page.tsx'
let s = fs.readFileSync(p, 'utf8')

// Add debug logging after each query
s = s.replace(
  /likedPrompts = likes\.map\(l => l\.prompt\)\.filter\(Boolean\)/,
  `likedPrompts = likes.map(l => l.prompt).filter(Boolean)
    console.log('DEBUG: Found', likes.length, 'likes for user', session.user.id)`
)

s = s.replace(
  /savedPrompts = bookmarks\.map\(b => b\.prompt\)\.filter\(Boolean\)/,
  `savedPrompts = bookmarks.map(b => b.prompt).filter(Boolean)
    console.log('DEBUG: Found', bookmarks.length, 'bookmarks for user', session.user.id)`
)

s = s.replace(
  /myPrompts = await prisma\.prompt\.findMany\(\{/,
  `console.log('DEBUG: Account page loaded for user', session.user.id)
    myPrompts = await prisma.prompt.findMany({`
)

s = s.replace(
  /myComments = await prisma\.comment\.findMany\(\{/,
  `console.log('DEBUG: Fetching comments for user', session.user.id)
    myComments = await prisma.comment.findMany({`
)

fs.writeFileSync(p, s)
console.log('✅ Account page: added debug logging')
NODEEOF

# ---------- 4) Ensure account page displays data correctly ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/account/page.tsx'
let s = fs.readFileSync(p, 'utf8')

// Check if the liked prompts section is rendering correctly
if (s.includes('likedPrompts.length > 0')) {
  console.log('✅ Liked prompts section exists')
} else {
  console.log('️ Liked prompts section missing')
}

if (s.includes('savedPrompts.length > 0')) {
  console.log('✅ Saved prompts section exists')
} else {
  console.log('️ Saved prompts section missing')
}
NODEEOF

echo "✅ update154 done!"