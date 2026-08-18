#!/bin/bash
set -e

# ---------- 1) layout: minimal + safe (no Toaster) ----------
cat > src/app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import dynamic from 'next/dynamic'
import './globals.css'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'

const RouteLoader = dynamic(() => import('@/components/route-loader'), { ssr: false })
const PWAControls = dynamic(() => import('@/components/pwa-controls'), { ssr: false })

export const metadata: Metadata = {
  title: 'PromptsFA',
  description: 'هزاران پرامپت حرفه‌ای هوش مصنوعی',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  return (
    <html lang={locale} dir={locale === 'fa' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body className="bg-[#070503] text-ink antialiased">
        <Header locale={locale} />
        <main>{children}</main>
        <Footer locale={locale} />
        <PWAControls />
        <RouteLoader />
      </body>
    </html>
  )
}
EOF
echo "✅ layout: minimal safe version"

# ---------- 2) notif-bell: no top-level document access ----------
cat > src/components/notif-bell.tsx << 'EOF'
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type N = { id: string; text: string; url: string; read: boolean; createdAt: string }

export default function NotifBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<N[]>([])
  const [unread, setUnread] = useState(0)
  const [permission, setPermission] = useState<string>('default')
  const [fa, setFa] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setFa(document.documentElement.lang !== 'en')
    if ('Notification' in window) setPermission(Notification.permission)
  }, [])

  const load = async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const j = await res.json()
        setItems(j.items)
        setUnread(j.unread)
      }
    } catch {}
  }

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && unread > 0) { setUnread(0); await fetch('/api/notifications/read', { method: 'POST' }).catch(() => {}) }
  }

  const enable = async () => {
    const p = await Notification.requestPermission()
    setPermission(p)
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={toggle} className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-elevated text-ink-muted transition-colors hover:text-gold-bright" aria-label="اعلان‌ها">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className="absolute -left-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-50 rounded-2xl border border-line bg-[#0a0805] p-3 shadow-2xl sm:absolute sm:inset-x-auto sm:top-12 sm:left-0 sm:w-80">
          <p className="px-2 pb-2 text-xs font-bold text-gold-bright">{fa ? 'اعلان‌ها' : 'Notifications'}</p>
          {'Notification' in window && permission === 'default' && (
            <button type="button" onClick={enable} className="btn-primary mb-2 w-full justify-center text-xs">
              {fa ? 'فعال‌سازی نوتیفیکیشن' : 'Enable notifications'}
            </button>
          )}
          {items.length === 0 ? (
            <p className="px-2 pb-2 text-[11px] text-ink-faint">{fa ? 'اعلانی نداری.' : 'No notifications.'}</p>
          ) : (
            <div className="max-h-80 space-y-1 overflow-auto">
              {items.map((n) => (
                <Link key={n.id} href={n.url} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 transition-colors hover:bg-elevated">
                  <p className="text-[11px] leading-5 text-ink-muted">{n.text}</p>
                  <p className="mt-1 text-[9px] text-ink-faint">{n.createdAt}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
EOF
echo "✅ notif-bell: safe (no top-level document)"

# ---------- 3) explore API route ----------
cat > src/app/api/explore/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 12

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const sort = searchParams.get('sort')
  const type = searchParams.get('type')
  const model = searchParams.get('model')
  const tags = (searchParams.get('tags') ?? '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 2)
  const q = searchParams.get('q') ?? ''

  const where: any = { status: 'PUBLISHED' }
  if (type) where.type = type
  if (model) where.model = model
  if (tags.length) where.tagsFa = { hasEvery: tags }
  if (q) {
    where.OR = [
      { titleFa: { contains: q, mode: 'insensitive' } },
      { titleEn: { contains: q, mode: 'insensitive' } },
      { prompt: { contains: q, mode: 'insensitive' } },
      { tagsFa: { hasSome: [q] } },
      { tagsEn: { hasSome: [q] } },
    ]
  }

  const orderBy = sort === 'likes' ? { likes: 'desc' } : sort === 'views' ? { views: 'desc' } : { createdAt: 'desc' }

  const [rows, total] = await Promise.all([
    prisma.prompt.findMany({ where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { category: true } }),
    prisma.prompt.count({ where }),
  ])

  return NextResponse.json({ rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) })
}
EOF
echo "✅ explore API ready"

# ---------- 4) explore grid client component (infinite scroll) ----------
cat > src/components/explore-grid.tsx << 'EOF'
'use client'

import { useEffect, useRef, useState } from 'react'
import PromptCard from '@/components/prompt-card'

type P = any

export default function ExploreGrid({ initial, qs, locale }: { initial: P[]; qs: (o: Record<string, string>) => string; locale: string }) {
  const [rows, setRows] = useState<P[]>(initial)
  const [page, setPage] = useState(1)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const initialRef = useRef(initial)

  useEffect(() => {
    if (initialRef.current !== initial) {
      setRows(initial)
      setPage(1)
      setDone(false)
      initialRef.current = initial
    }
  }, [initial])

  useEffect(() => {
    if (!sentinel.current || done) return
    const io = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting || loading || done) return
      setLoading(true)
      try {
        const res = await fetch('/api/explore?' + qs({ page: String(page + 1) }))
        const j = await res.json()
        if (j.rows.length === 0) setDone(true)
        else {
          setRows((r) => r.concat(j.rows))
          setPage(page + 1)
          if (page + 1 >= j.pages) setDone(true)
        }
      } catch {}
      setLoading(false)
    }, { rootMargin: '600px' })
    io.observe(sentinel.current)
    return () => io.disconnect()
  }, [page, done, loading, qs])

  return (
    <>
      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
        {rows.map((p, i) => (
          <PromptCard key={p.id + '-' + i} item={p} locale={locale as any} isNew={Date.now() - new Date(p.createdAt).getTime() < 48 * 3600 * 1000} />
        ))}
      </div>
      <div ref={sentinel} className="flex h-16 items-center justify-center">
        {loading && <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />}
        {done && rows.length > 0 && <p className="text-xs text-ink-faint">— {locale === 'fa' ? 'پایان' : 'end'} —</p>}
      </div>
    </>
  )
}
EOF
echo "✅ explore-grid: infinite scroll"

# ---------- 5) explore page: use grid + preserve filters ----------
cat > src/app/explore/page.tsx << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { promptTypes, L } from '@/lib/data'
import { TAG_VOCAB } from '@/lib/gemini'
import { prisma } from '@/lib/db'
import TagFilter from '@/components/tag-filter'
import ExploreGrid from '@/components/explore-grid'

export const metadata = { title: 'کاوش', description: 'جستجو و فیلتر پرامپت‌ها' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const selectedTags = (params.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 2)
  const sort = params.sort === 'likes' ? 'likes' : params.sort === 'views' ? 'views' : 'newest'
  const model = params.model ?? ''

  const where: any = { status: 'PUBLISHED' }
  if (params.type) where.type = params.type
  if (model) where.model = model
  if (selectedTags.length) where.tagsFa = { hasEvery: selectedTags }
  if (params.q) {
    const q = params.q
    where.OR = [
      { titleFa: { contains: q, mode: 'insensitive' } },
      { titleEn: { contains: q, mode: 'insensitive' } },
      { prompt: { contains: q, mode: 'insensitive' } },
      { tagsFa: { hasSome: [q] } },
      { tagsEn: { hasSome: [q] } },
    ]
  }

  const orderBy = sort === 'likes' ? { likes: 'desc' as const } : sort === 'views' ? { views: 'desc' as const } : { createdAt: 'desc' as const }
  const [rows, models, allTagsRows] = await Promise.all([
    prisma.prompt.findMany({ where, orderBy, take: PAGE_SIZE, include: { category: true } }),
    prisma.prompt.findMany({ where: { status: 'PUBLISHED' }, select: { model: true }, distinct: ['model'] }),
    prisma.prompt.findMany({ where: { status: 'PUBLISHED' }, select: { tagsFa: true } }),
  ])

  const freq: Record<string, number> = {}
  for (const r of allTagsRows) for (const t of r.tagsFa) freq[t] = (freq[t] ?? 0) + 1
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map((e) => e[0])

  const qs = (over: Record<string, string | undefined>) => {
    const sp = new URLSearchParams()
    const merged = { ...params, ...over }
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v)
    return sp.toString()
  }
  const chip = (active: boolean) =>
    'rounded-full border px-4 py-1.5 text-xs transition-colors ' +
    (active ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted hover:border-gold/40')

  return (
    <section className="container-app py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{L(locale, 'کاوش', 'Explore')}</h1>

      <form action="/explore" className="mt-6 flex max-w-2xl gap-3">
        <input name="q" defaultValue={params.q ?? ''} placeholder={L(locale, 'جستجو در پرامپت‌ها...', 'Search prompts...')} className="input text-base" />
        <button type="submit" className="btn-primary whitespace-nowrap">{L(locale, 'جستجو', 'Search')}</button>
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        {promptTypes.map((t) => (
          <Link key={t.value} href={'/explore?' + qs({ type: t.value })} className={chip(params.type === t.value)}>
            {L(locale, t.fa, t.en)}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={'/explore?' + qs({ sort: 'newest' })} className={chip(sort === 'newest')}>{L(locale, 'جدید', 'New')}</Link>
        <Link href={'/explore?' + qs({ sort: 'likes' })} className={chip(sort === 'likes')}>{L(locale, 'محبوب', 'Popular')}</Link>
        <Link href={'/explore?' + qs({ sort: 'views' })} className={chip(sort === 'views')}>{L(locale, 'پربازدید', 'Trending')}</Link>
      </div>

      {top.length > 0 && (
        <div className="mt-4">
          <TagFilter tags={top} selected={selectedTags} />
        </div>
      )}

      {models.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {models.map((m) => (
            <Link key={m.model} href={'/explore?' + qs({ model: m.model })} className={chip(model === m.model)}>{m.model}</Link>
          ))}
        </div>
      )}

      <div className="mt-10">
        <ExploreGrid initial={rows} qs={(o) => qs(o as any)} locale={locale} />
      </div>
    </section>
  )
}
EOF
echo "✅ explore page: wired to infinite grid"

echo "✅ update91 done!"