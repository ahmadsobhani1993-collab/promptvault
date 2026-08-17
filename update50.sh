#!/bin/bash
set -e

# ---------- schema: self-hosted images ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'prisma/schema.prisma'
let s = fs.readFileSync(p, 'utf8')
const block = s.match(/model Prompt \{[\s\S]*?\n\}/)
if (block && !block[0].includes('imgData')) {
  s = s.replace(block[0], block[0].replace(/\n\}$/, '\n  imgData    String?\n  imgType    String?\n}'))
  fs.writeFileSync(p, s)
  console.log('✅ schema: imgData/imgType added')
} else console.log('⚠️ imgData already present')
NODEEOF

# ---------- image server route ----------
mkdir -p 'src/app/api/img/[id]'
cat > 'src/app/api/img/[id]/route.ts' << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const p = await prisma.prompt.findUnique({ where: { id }, select: { imgData: true, imgType: true } })
  if (!p?.imgData) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return new Response(Buffer.from(p.imgData, 'base64'), {
    headers: {
      'Content-Type': p.imgType ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
EOF

# ---------- single share button ----------
cat > src/components/share-buttons.tsx << 'EOF'
'use client'

import { useState } from 'react'

export default function ShareButtons({ title, desc }: { title: string; desc: string }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = window.location.href
    const text = '✨ ' + title + (desc ? '\n' + desc : '')
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: '✨ ' + title, text, url })
        return
      } catch {
        return
      }
    }
    window.open(
      'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text),
      '_blank'
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={share} className="btn-primary">
        📤 اشتراک
      </button>
      <button type="button" onClick={copy} className="btn-secondary px-3" title="کپی لینک">
        {copied ? '✅' : '🔗'}
      </button>
    </div>
  )
}
EOF

# ---------- logout button ----------
cat > src/components/logout-button.tsx << 'EOF'
'use client'

import { signOut } from 'next-auth/react'

export default function LogoutButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => signOut({ callbackUrl: '/' })} className="btn-secondary">
      {label}
    </button>
  )
}
EOF

# ---------- header: one submit + logout + left-opening pretty dropdown ----------
cat > src/components/layout/header.tsx << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { type Locale } from '@/lib/i18n'
import { getCategories, L } from '@/lib/data'
import LocaleSwitcher from '@/components/locale-switcher'
import MobileMenu from '@/components/mobile-menu'
import LogoutButton from '@/components/logout-button'

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
            <div className="invisible absolute right-0 top-full z-50 w-[26rem] pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
              <div className="card grid grid-cols-2 gap-4 p-5">
                {categories.map((c) => (
                  <div key={c.id} className="rounded-xl border border-line/60 bg-elevated/40 p-3">
                    <Link href={'/categories/' + c.slug} className="flex items-center gap-2 text-sm font-bold text-ink transition-colors hover:text-gold-bright">
                      <span className="text-base">{c.icon}</span>
                      {L(locale, c.nameFa, c.nameEn)}
                    </Link>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {c.subs.map((s) => (
                        <Link
                          key={s.id}
                          href={'/categories/' + c.slug + '?sub=' + s.slug}
                          className="rounded-full border border-line bg-elevated px-2.5 py-1 text-[10px] text-ink-muted transition-colors hover:border-gold/50 hover:text-gold-bright"
                        >
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
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          {session?.user ? (
            <>
              {isAdmin && (
                <Link href="/admin" className="btn-secondary hidden lg:inline-flex">🛠 {L(locale, 'مدیریت', 'Admin')}</Link>
              )}
              <Link href="/submit" className="btn-primary">+ {L(locale, 'ارسال', 'Submit')}</Link>
              <LogoutButton label={L(locale, 'خروج', 'Logout')} />
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

# ---------- blog list with SafeImg ----------
cat > src/app/blog/page.tsx << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { getArticles, L } from '@/lib/data'
import SafeImg from '@/components/safe-img'

export const metadata = { title: 'وبلاگ', description: 'آموزش‌های هوش مصنوعی' }
export const dynamic = 'force-dynamic'

export default async function BlogPage() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const articles = await getArticles()

  return (
    <section className="container-app py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {L(locale, 'وبلاگ و آموزش هوش مصنوعی', 'AI Blog & Tutorials')}
      </h1>

      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {articles.map((a) => (
          <Link
            key={a.id}
            href={'/blog/' + a.slug}
            className="card glow-gold overflow-hidden transition-transform hover:-translate-y-1"
          >
            <SafeImg src={a.img} alt={L(locale, a.titleFa, a.titleEn)} className="aspect-video w-full object-cover" />
            <div className="p-5">
              <span className="gold-badge">{L(locale, a.tagFa, a.tagEn)}</span>
              <h2 className="mt-3 font-display text-lg font-extrabold leading-snug">
                {L(locale, a.titleFa, a.titleEn)}
              </h2>
              <p className="mt-2 line-clamp-2 text-xs leading-6 text-ink-muted">
                {L(locale, a.descFa, a.descEn)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
EOF

# ---------- detail: remove star, keep single share ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/prompts/[slug]/page.tsx'
let s = fs.readFileSync(p, 'utf8')

// remove StarButton usage + import
s = s.replace(/\n?\s*<StarButton[^>]*\/>/, '')
s = s.replace("import StarButton from '@/components/star-button'\n", '')

// ensure ShareButtons present
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
            <ShareButtons title={L(locale, item.titleFa, item.titleEn)} desc={L(locale, item.descFa ?? '', item.descEn ?? '')} />
          </div>

          <div className="mt-5 flex flex-wrap gap-1">`
    )
  }
}

fs.writeFileSync(p, s)
console.log('✅ detail: star removed, single share ready')
NODEEOF

# ---------- article cron: robust JSON + self-host image ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/article/route.ts'
let s = fs.readFileSync(p, 'utf8')

s = s.replace(
  "const a = JSON.parse(m[0])",
  `let a: any
  try {
    a = JSON.parse(m[0])
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json from gemini', raw: raw.slice(0, 300) }, { status: 500 })
  }`
)

fs.writeFileSync(p, s)
console.log('✅ article cron: robust JSON parse')
NODEEOF

# ---------- telegram cron: self-hosted images ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/telegram/route.ts'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('imgData')) {
  // capture content type
  s = s.replace(
    `        const ir = await fetch(img, { signal: AbortSignal.timeout(8000) })
        const buf = Buffer.from(await ir.arrayBuffer())
        if (buf.length < 4_000_000) imgBase64 = buf.toString('base64')`,
    `        const ir = await fetch(img, { signal: AbortSignal.timeout(8000) })
        const buf = Buffer.from(await ir.arrayBuffer())
        if (buf.length < 4_000_000) {
          imgBase64 = buf.toString('base64')
          imgType = ir.headers.get('content-type') ?? 'image/jpeg'
        }`
  )

  s = s.replace('let imgBase64: string | null = null', 'let imgBase64: string | null = null\n    let imgType = "image/jpeg"')

  // after create: store self-hosted image
  s = s.replace(
    `    await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'PROCESSED', promptId: prompt.id } })`,
    `    if (imgBase64 && imgBase64.length < 1_200_000) {
      const selfUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '') + '/api/img/' + prompt.id
      await prisma.prompt.update({ where: { id: prompt.id }, data: { imgData: imgBase64, imgType, img: selfUrl } })
      finalImg = selfUrl
    }

    await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'PROCESSED', promptId: prompt.id } })`
  )

  fs.writeFileSync(p, s)
  console.log('✅ telegram cron: self-hosted images')
} else console.log('⚠️ already patched')
NODEEOF

echo "✅ update50 done!"
