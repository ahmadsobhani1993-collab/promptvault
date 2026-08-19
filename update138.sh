#!/bin/bash
set -e

# ---------- 1) Fix account page: proper queries for likes, comments, bookmarks ----------
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

  // Get all data
  const [likedPrompts, savedPrompts, myPrompts, myComments] = await Promise.all([
    // Liked prompts
    prisma.like.findMany({
      where: { userId },
      include: { prompt: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    // Bookmarked prompts
    prisma.bookmark.findMany({
      where: { userId },
      include: { prompt: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    // User's submitted prompts
    prisma.prompt.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    // User's comments
    prisma.comment.findMany({
      where: { userId },
      include: { prompt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  return (
    <section className="container-app py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{L(locale, 'حساب کاربری', 'Account')}</h1>
          <p className="mt-2 text-sm text-ink-muted">{session.user.email}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/account/edit" className="btn-secondary text-xs">
            {L(locale, 'ویرایش پروفایل', 'Edit Profile')}
          </Link>
          {session.user.role === 'ADMIN' && (
            <Link href="/admin" className="btn-primary text-xs">
              {L(locale, 'پنل مدیریت', 'Admin Panel')}
            </Link>
          )}
        </div>
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
        {likedPrompts.length > 0 ? (
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
          </div>
        ) : (
          <p className="card p-6 text-center text-sm text-ink-faint">
            {L(locale, 'هنوز پرامپتی لایک نکرده‌اید', 'No liked prompts yet')}
          </p>
        )}
      </div>

      {/* Saved Prompts */}
      <div className="mb-8">
        <h2 className="mb-4 font-display text-xl font-extrabold text-gold-bright">
          {L(locale, 'پرامپت‌های ذخیره شده', 'Saved Prompts')}
        </h2>
        {savedPrompts.length > 0 ? (
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
          </div>
        ) : (
          <p className="card p-6 text-center text-sm text-ink-faint">
            {L(locale, 'هنوز پرامپتی ذخیره نکرده‌اید', 'No saved prompts yet')}
          </p>
        )}
      </div>

      {/* My Prompts */}
      <div className="mb-8">
        <h2 className="mb-4 font-display text-xl font-extrabold text-gold-bright">
          {L(locale, 'پرامپت‌های ارسالی من', 'My Submitted Prompts')}
        </h2>
        {myPrompts.length > 0 ? (
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
            </div>
          </div>
        ) : (
          <p className="card p-6 text-center text-sm text-ink-faint">
            {L(locale, 'هنوز پرامپتی ارسال نکرده‌اید', 'No submitted prompts yet')}
          </p>
        )}
      </div>

      {/* My Comments */}
      <div>
        <h2 className="mb-4 font-display text-xl font-extrabold text-gold-bright">
          {L(locale, 'کامنت‌های من', 'My Comments')}
        </h2>
        {myComments.length > 0 ? (
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
            </div>
          </div>
        ) : (
          <p className="card p-6 text-center text-sm text-ink-faint">
            {L(locale, 'هنوز کامنتی نگذاشته‌اید', 'No comments yet')}
          </p>
        )}
      </div>
    </section>
  )
}
EOF
echo "✅ Account page: fixed queries"

# ---------- 2) Edit profile page (change name) ----------
mkdir -p src/app/account/edit

cat > src/app/account/edit/page.tsx << 'EOF'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { L } from '@/lib/data'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'ویرایش پروفایل | PromptsFA' }

export default async function EditProfilePage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  })

  return (
    <section className="container-app py-10">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-2xl font-extrabold text-center">
          {L(locale, 'ویرایش پروفایل', 'Edit Profile')}
        </h1>
        
        <form
          action={async (formData) => {
            'use server'
            const name = formData.get('name') as string
            if (name && name.trim()) {
              await prisma.user.update({
                where: { id: session.user.id },
                data: { name: name.trim() },
              })
            }
            redirect('/account')
          }}
          className="card mt-6 space-y-4 p-6"
        >
          <div>
            <label className="mb-1 block text-xs text-ink-muted">
              {L(locale, 'نام', 'Name')}
            </label>
            <input
              name="name"
              type="text"
              defaultValue={user?.name || ''}
              placeholder={L(locale, 'نام شما', 'Your name')}
              className="input text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-muted">
              {L(locale, 'ایمیل', 'Email')}
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="input text-sm opacity-50"
            />
            <p className="mt-1 text-[10px] text-ink-faint">
              {L(locale, 'ایمیل قابل تغییر نیست', 'Email cannot be changed')}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1">
              {L(locale, 'ذخیره تغییرات', 'Save Changes')}
            </button>
            <a href="/account" className="btn-secondary flex-1 text-center">
              {L(locale, 'انصراف', 'Cancel')}
            </a>
          </div>
        </form>
      </div>
    </section>
  )
}
EOF
echo "✅ Edit profile page created"

# ---------- 3) PWA button: higher z-index + ensure visible ----------
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
      className="fixed bottom-4 right-4 z-[9999] flex h-12 w-12 items-center justify-center rounded-full bg-gold/90 text-black shadow-2xl transition-all hover:scale-110 active:scale-95 md:bottom-6 md:right-6"
      title="نصب اپلیکیشن"
      style={{ pointerEvents: 'auto' }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  )
}
EOF
echo "✅ PWA button: higher z-index"

# ---------- 4) Ensure prompt translation is saved to DB ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/gemini.ts'
let s = fs.readFileSync(p, 'utf8')

// Check if promptFa is in the return type
if (!s.includes('promptFa: string')) {
  s = s.replace(
    /export type GeminiResult = \{[\s\S]*?\}/,
    `export type GeminiResult = {
  titleFa: string
  titleEn: string
  descFa: string
  descEn: string
  usageFa: string
  usageEn: string
  categorySlug: string
  tagsFa: string[]
  tagsEn: string[]
  promptEn: string
  promptFa: string
}`
  )
  console.log('✅ GeminiResult: promptFa added')
} else {
  console.log('️ promptFa already in type')
}

// Ensure promptFa is returned
if (!s.includes('promptFa: String(parsed.promptFa')) {
  s = s.replace(
    /promptEn: String\(parsed\.promptEn \|\| ''\),[\s\S]*?promptFa: String\(parsed\.promptFa \|\| parsed\.promptEn \|\| ''\),/,
    `promptEn: String(parsed.promptEn || ''),
    promptFa: String(parsed.promptFa || parsed.promptEn || ''),`
  )
  console.log('✅ promptFa return fixed')
}

fs.writeFileSync(p, s)
NODEEOF

# Update the prompt processing to save promptFa
node << 'NODEEOF'
const fs = require('fs')
const files = [
  'src/app/api/import/route.ts',
  'src/lib/schedule.ts'
]

for (const file of files) {
  if (!fs.existsSync(file)) continue
  let s = fs.readFileSync(file, 'utf8')
  
  // Add promptFa to create/update
  if (s.includes('prompt: result.promptEn') && !s.includes('promptFa:')) {
    s = s.replace(
      'prompt: result.promptEn',
      `prompt: result.promptEn,
        promptFa: result.promptFa`
    )
    fs.writeFileSync(file, s)
    console.log('✅ ' + file + ': promptFa added')
  }
}
NODEEOF

echo "✅ update138 done!"