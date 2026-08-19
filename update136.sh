#!/bin/bash
set -e

# ---------- 1) Gemini: translate tags to Persian (except proper nouns) ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/gemini.ts'
let s = fs.readFileSync(p, 'utf8')

// Update the instruction to translate tags
s = s.replace(
  /'- tagsFa: JSON ARRAY of MAX 4 items ONLY from: ' \+\s*TAG_VOCAB\.map\(\(t\) => t\.fa\)\.join\('، '\) \+/g,
  `'- tagsFa: JSON ARRAY of MAX 4 items. Translate tags to Persian (except proper nouns like Midjourney, Stable Diffusion, etc.). Choose from: ' +\n    TAG_VOCAB.map((t) => t.fa).join('، ') +\n    '\\n- tagsEn: English equivalents of chosen tagsFa in same order.' +\n    '\\n\\nTHE PROMPT TEXT:\\n' + (opts.text || '(no text, look at image)')`
)

// Remove the old tagsEn line
s = s.replace(/\\n- tagsEn: JSON ARRAY.*?\\n/g, '')

fs.writeFileSync(p, s)
console.log('✅ Gemini: tags translation instruction updated')
NODEEOF

# ---------- 2) User dashboard page ----------
mkdir -p src/app/account

cat > src/app/account/page.tsx << 'EOF'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { L } from '@/lib/data'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'حساب کاربری | PromptsFA' }

export default async function AccountPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const userId = session.user.id!

  const [likedPrompts, savedPrompts, myPrompts, myComments] = await Promise.all([
    prisma.like.findMany({
      where: { userId },
      include: { prompt: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.bookmark.findMany({
      where: { userId },
      include: { prompt: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.prompt.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.comment.findMany({
      where: { userId },
      include: { prompt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  const chip = (active: boolean) =>
    'rounded-full border px-4 py-1.5 text-xs transition-colors ' +
    (active ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted hover:border-gold/40')

  return (
    <section className="container-app py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{L(locale, 'حساب کاربری', 'Account')}</h1>
          <p className="mt-2 text-sm text-ink-muted">{session.user.email}</p>
        </div>
        {session.user.role === 'ADMIN' && (
          <Link href="/admin" className="btn-primary text-xs">
            {L(locale, 'پنل مدیریت', 'Admin Panel')}
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4 text-center">
          <p className="text-xs text-ink-muted">{L(locale, 'لایک‌ها', 'Likes')}</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{likedPrompts.length}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-ink-muted">{L(locale, 'ذخیره‌ها', 'Saved')}</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{savedPrompts.length}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-ink-muted">{L(locale, 'پرامپت‌های من', 'My Prompts')}</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{myPrompts.length}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-ink-muted">{L(locale, 'کامنت‌ها', 'Comments')}</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{myComments.length}</p>
        </div>
      </div>

      {/* Liked Prompts */}
      <div className="mb-8">
        <h2 className="mb-4 font-display text-xl font-extrabold text-gold-bright">
          {L(locale, 'پرامپت‌های لایک شده', 'Liked Prompts')}
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {likedPrompts.map((l) => l.prompt).filter(Boolean).map((p) => (
            <Link key={p.id} href={'/prompts/' + p.slug} className="card overflow-hidden transition-all hover:border-gold/40">
              <div className="aspect-square overflow-hidden bg-[#0f0d0a]">
                {p.img && <img src={p.img} alt={p.titleFa} className="h-full w-full object-cover" />}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-xs font-bold">{p.titleFa}</p>
                <p className="mt-1 text-[10px] text-ink-muted">{p.category?.nameFa}</p>
              </div>
            </Link>
          ))}
          {likedPrompts.length === 0 && <p className="col-span-full text-center text-sm text-ink-faint">
            {L(locale, 'هنوز پرامپتی لایک نکرده‌اید', 'No liked prompts yet')}
          </p>}
        </div>
      </div>

      {/* Saved Prompts */}
      <div className="mb-8">
        <h2 className="mb-4 font-display text-xl font-extrabold text-gold-bright">
          {L(locale, 'پرامپت‌های ذخیره شده', 'Saved Prompts')}
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {savedPrompts.map((b) => b.prompt).filter(Boolean).map((p) => (
            <Link key={p.id} href={'/prompts/' + p.slug} className="card overflow-hidden transition-all hover:border-gold/40">
              <div className="aspect-square overflow-hidden bg-[#0f0d0a]">
                {p.img && <img src={p.img} alt={p.titleFa} className="h-full w-full object-cover" />}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-xs font-bold">{p.titleFa}</p>
                <p className="mt-1 text-[10px] text-ink-muted">{p.category?.nameFa}</p>
              </div>
            </Link>
          ))}
          {savedPrompts.length === 0 && <p className="col-span-full text-center text-sm text-ink-faint">
            {L(locale, 'هنوز پرامپتی ذخیره نکرده‌اید', 'No saved prompts yet')}
          </p>}
        </div>
      </div>

      {/* My Prompts */}
      <div className="mb-8">
        <h2 className="mb-4 font-display text-xl font-extrabold text-gold-bright">
          {L(locale, 'پرامپت‌های ارسالی من', 'My Submitted Prompts')}
        </h2>
        <div className="card overflow-hidden">
          <div className="divide-y divide-line">
            {myPrompts.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-4">
                <div>
                  <Link href={'/prompts/' + p.slug} className="text-xs font-bold text-ink hover:text-gold-bright">
                    {p.titleFa}
                  </Link>
                  <p className="mt-1 text-[10px] text-ink-faint">
                    {new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium' }).format(p.createdAt)}
                  </p>
                </div>
                <span className={
                  'rounded-full px-2 py-0.5 text-[9px] ' +
                  (p.status === 'PUBLISHED' ? 'bg-green-500/15 text-green-400' :
                   p.status === 'PENDING' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400')
                }>
                  {p.status === 'PUBLISHED' ? 'منتشر' : p.status === 'PENDING' ? 'در انتظار' : 'رد شده'}
                </span>
              </div>
            ))}
            {myPrompts.length === 0 && <p className="p-6 text-center text-sm text-ink-faint">
              {L(locale, 'هنوز پرامپتی ارسال نکرده‌اید', 'No submitted prompts yet')}
            </p>}
          </div>
        </div>
      </div>

      {/* My Comments */}
      <div>
        <h2 className="mb-4 font-display text-xl font-extrabold text-gold-bright">
          {L(locale, 'کامنت‌های من', 'My Comments')}
        </h2>
        <div className="card overflow-hidden">
          <div className="divide-y divide-line">
            {myComments.map((c) => (
              <div key={c.id} className="p-4">
                <p className="text-xs text-ink">{c.text}</p>
                <div className="mt-2 flex items-center justify-between">
                  <Link href={'/prompts/' + c.prompt?.slug} className="text-[10px] text-gold-bright hover:underline">
                    {c.prompt?.titleFa}
                  </Link>
                  <span className="text-[10px] text-ink-faint">
                    {new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium' }).format(c.createdAt)}
                  </span>
                </div>
              </div>
            ))}
            {myComments.length === 0 && <p className="p-6 text-center text-sm text-ink-faint">
              {L(locale, 'هنوز کامنتی نگذاشته‌اید', 'No comments yet')}
            </p>}
          </div>
        </div>
      </div>
    </section>
  )
}
EOF
echo "✅ User account page created"

# ---------- 3) Add account link to header ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/header.tsx'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('/account')) {
  s = s.replace(
    /(\{session\?\.user \? \(\s*<>)/,
    "$1\n              <Link href=\"/account\" className=\"btn-secondary hidden md:inline-flex\">👤 {L(locale, 'حساب', 'Account')}</Link>"
  )
  fs.writeFileSync(p, s)
  console.log('✅ Header: account link added')
} else {
  console.log('⚠️ Already has account link')
}
NODEEOF

# ---------- 4) PWA button: minimal icon, bottom-right ----------
cat > src/components/pwa-controls.tsx << 'EOF'
'use client'

import { useEffect, useState } from 'react'

export default function PWAControls() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true)
        return
      }

      const handler = (e: any) => {
        e.preventDefault()
        setDeferredPrompt(e)
      }

      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setIsInstalled(true)
      }
    }
  }

  if (isInstalled || !deferredPrompt) return null

  return (
    <button
      onClick={handleInstall}
      className="fixed bottom-4 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-gold/90 text-black shadow-lg transition-all hover:scale-110 active:scale-95 md:bottom-6 md:right-6"
      title="نصب اپلیکیشن"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  )
}
EOF
echo "✅ PWA button: minimal icon"

# ---------- 5) Admin layout: mobile-first (buttons on top) ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/admin/layout.tsx'
let s = fs.readFileSync(p, 'utf8')

// Change flex direction for mobile
s = s.replace(
  'className="container-app flex gap-8 py-10"',
  'className="container-app flex flex-col-reverse gap-8 py-10 md:flex-row"'
)

// Make sidebar horizontal on mobile
s = s.replace(
  'className="w-52 shrink-0"',
  'className="w-full shrink-0 md:w-52"'
)

s = s.replace(
  'className="flex flex-col gap-2"',
  'className="flex flex-row flex-wrap gap-2 md:flex-col"'
)

fs.writeFileSync(p, s)
console.log('✅ Admin layout: mobile-first')
NODEEOF

# ---------- 6) Fix analytics: ensure PageView model exists and track works ----------
node << 'NODEEOF'
const fs = require('fs')
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8')

if (!schema.includes('model PageView')) {
  let s = schema + '\nmodel PageView {\n  id        String   @id @default(cuid())\n  path      String\n  referrer  String?\n  ua        String?\n  ip        String?\n  createdAt DateTime @default(now())\n}\n'
  fs.writeFileSync('prisma/schema.prisma', s)
  console.log('✅ PageView model added to schema')
} else {
  console.log('⚠️ PageView already exists')
}
NODEEOF

# Ensure analytics component is mounted
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/layout.tsx'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('Analytics')) {
  s = s.replace(
    "import Footer from '@/components/layout/footer'",
    "import Footer from '@/components/layout/footer'\nimport Analytics from '@/components/analytics'"
  )
  s = s.replace('<RouteLoader />', '<RouteLoader />\n        <Analytics />')
  fs.writeFileSync(p, s)
  console.log('✅ Analytics mounted in layout')
} else {
  console.log('️ Analytics already mounted')
}
NODEEOF

echo "✅ update136 done!"