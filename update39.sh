#!/bin/bash
set -e

mkdir -p src/app/api/debug/deseed

# ---------- StarButton safe ----------
cat > src/components/star-button.tsx << 'EOF'
'use client'

import { useEffect, useState } from 'react'

export default function StarButton({
  promptId,
  initial,
  label,
}: {
  promptId: string
  initial: number
  label: string
}) {
  const safe = Number.isFinite(initial) ? initial : 0
  const [count, setCount] = useState(safe)
  const [starred, setStarred] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('star-' + promptId)) setStarred(true)
  }, [promptId])

  const give = async () => {
    if (starred) return
    setStarred(true)
    localStorage.setItem('star-' + promptId, '1')
    setCount((c) => c + 1)
    const res = await fetch('/api/stars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptId }),
    })
    if (res.ok) {
      const j = await res.json()
      if (Number.isFinite(j.stars)) setCount(j.stars)
    }
  }

  return (
    <button type="button" onClick={give} className={starred ? 'btn-primary' : 'btn-secondary'} title={label}>
      <svg viewBox="0 0 24 24" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
      </svg>
      {count} {label}
    </button>
  )
}
EOF

# ---------- Header (written to the REAL import path) ----------
mkdir -p /tmp/pv
cat > /tmp/pv/header.tsx << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { type Locale } from '@/lib/i18n'
import { getCategories, L } from '@/lib/data'
import LocaleSwitcher from '@/components/locale-switcher'

export default async function Header() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const session = await auth()
  const categories = await getCategories()

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-[#070503]/85 backdrop-blur">
      <div className="container-app flex h-16 items-center justify-between gap-4">
        <Link href="/" className="font-display text-lg font-extrabold tracking-tight">
          Prompts<span className="text-gold-bright">FA</span>
        </Link>

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
                    <Link
                      href={'/categories/' + c.slug}
                      className="block rounded-lg px-3 py-1.5 text-sm font-bold text-ink transition-colors hover:bg-elevated hover:text-gold-bright"
                    >
                      {c.icon} {L(locale, c.nameFa, c.nameEn)}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-1.5 px-3">
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

          <Link href="/blog" className="transition-colors hover:text-gold-bright">{L(locale, 'مقالات', 'Blog')}</Link>
          <span className="cursor-default text-ink-faint">
            {L(locale, 'سازندگان', 'Creators')}{' '}
            <span className="rounded-full border border-line px-1.5 py-0.5 text-[9px]">{L(locale, 'به‌زودی', 'soon')}</span>
          </span>
          <Link href="/submit" className="transition-colors hover:text-gold-bright">{L(locale, 'ارسال پرامپت', 'Submit')}</Link>
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          {session?.user ? (
            <>
              {session.user.role === 'ADMIN' && (
                <Link href="/admin" className="btn-secondary">Admin</Link>
              )}
              <span className="hidden max-w-28 truncate text-xs text-ink-muted sm:block">{session.user.name}</span>
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

node << 'NODEEOF'
const fs = require('fs')
const path = require('path')
const layout = fs.readFileSync('src/app/layout.tsx', 'utf8')
const m = layout.match(/import Header from ['"]([^'"]+)['"]/)
console.log('header import found:', m ? m[1] : 'NONE')
const content = fs.readFileSync('/tmp/pv/header.tsx', 'utf8')
const targets = new Set()
if (m) {
  const rel = m[1].replace('@/', 'src/')
  targets.add(rel + (rel.endsWith('.tsx') ? '' : '.tsx'))
}
targets.add('src/components/layout/header.tsx')
targets.add('src/components/header.tsx')
for (const t of targets) {
  fs.mkdirSync(path.dirname(t), { recursive: true })
  fs.writeFileSync(t, content)
  console.log('✅ header written to', t)
}
NODEEOF

# ---------- Explore: search button + sort + model filter + pagination ----------
cat > src/app/explore/page.tsx << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { promptTypes, L } from '@/lib/data'
import { TAG_VOCAB } from '@/lib/gemini'
import { prisma } from '@/lib/db'
import PromptCard from '@/components/prompt-card'
import TagFilter from '@/components/tag-filter'

export const metadata = { title: 'کاوش', description: 'جستجو و فیلتر پرامپت‌ها' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const selectedTags = (params.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 2)
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
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

  const orderBy =
    sort === 'likes' ? { likes: 'desc' as const } : sort === 'views' ? { views: 'desc' as const } : { createdAt: 'desc' as const }

  const [rows, total, models, allTagsRows] = await Promise.all([
    prisma.prompt.findMany({ where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { category: true, sub: true } }),
    prisma.prompt.count({ where }),
    prisma.prompt.findMany({ where: { status: 'PUBLISHED' }, select: { model: true }, distinct: ['model'] }),
    prisma.prompt.findMany({ where: { status: 'PUBLISHED' }, select: { tagsFa: true } }),
  ])

  const freq: Record<string, number> = {}
  for (const r of allTagsRows) for (const t of r.tagsFa) freq[t] = (freq[t] ?? 0) + 1
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map((e) => e[0])

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

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
        <input
          name="q"
          defaultValue={params.q ?? ''}
          placeholder={L(locale, 'جستجو در پرامپت‌ها...', 'Search prompts...')}
          className="input text-base"
        />
        <button type="submit" className="btn-primary shrink-0">{L(locale, 'جستجو', 'Search')}</button>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link href={'/explore?' + qs({ type: undefined, page: undefined })} className={chip(!params.type)}>
          {L(locale, 'همه', 'All')}
        </Link>
        {promptTypes.map((tp) => (
          <Link key={tp.value} href={'/explore?' + qs({ type: tp.value, page: undefined })} className={chip(params.type === tp.value)}>
            {L(locale, tp.fa, tp.en)}
          </Link>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-ink-faint">{L(locale, 'مرتب‌سازی:', 'Sort:')}</span>
        <Link href={'/explore?' + qs({ sort: undefined, page: undefined })} className={chip(sort === 'newest')}>{L(locale, 'جدیدترین', 'Newest')}</Link>
        <Link href={'/explore?' + qs({ sort: 'likes', page: undefined })} className={chip(sort === 'likes')}>{L(locale, 'پرپسندترین', 'Most liked')}</Link>
        <Link href={'/explore?' + qs({ sort: 'views', page: undefined })} className={chip(sort === 'views')}>{L(locale, 'پربازدیدترین', 'Most viewed')}</Link>

        {models.length > 0 && (
          <>
            <span className="mr-4 text-ink-faint">{L(locale, 'مدل:', 'Model:')}</span>
            {models.map((m) => (
              <Link key={m.model} href={'/explore?' + qs({ model: model === m.model ? undefined : m.model, page: undefined })} className={chip(model === m.model)}>
                {m.model}
              </Link>
            ))}
          </>
        )}
      </div>

      <TagFilter all={TAG_VOCAB.map((t) => t.fa)} top={top.length ? top : TAG_VOCAB.slice(0, 8).map((t) => t.fa)} selected={selectedTags} />

      <p className="mt-6 text-xs text-ink-faint">{total} {L(locale, 'نتیجه', 'results')}</p>

      {rows.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
          {rows.map((item) => (
            <PromptCard
              key={item.id}
              item={item}
              locale={locale}
              cornerTags={selectedTags}
              isNew={Date.now() - new Date(item.createdAt).getTime() < 48 * 3600 * 1000}
            />
          ))}
        </div>
      ) : (
        <div className="card mt-10 p-10 text-center text-sm text-ink-muted">
          {L(locale, 'نتیجه‌ای پیدا نشد.', 'No results found.')}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-12 flex items-center justify-center gap-4 text-sm">
          {page > 1 && (
            <Link className="btn-secondary" href={'/explore?' + qs({ page: String(page - 1) })}>
              {L(locale, '← قبلی', '← Prev')}
            </Link>
          )}
          <span className="text-xs text-ink-muted">{page} / {pages}</span>
          {page < pages && (
            <Link className="btn-secondary" href={'/explore?' + qs({ page: String(page + 1) })}>
              {L(locale, 'بعدی →', 'Next →')}
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
EOF

# ---------- deseed demo data ----------
cat > src/app/api/debug/deseed/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const res = await prisma.prompt.deleteMany({
    where: {
      slug: { not: { startsWith: 'tg-' } },
      userId: null,
      status: 'PUBLISHED',
    },
  })

  return NextResponse.json({ ok: true, deletedDemo: res.count })
}
EOF

# ---------- detail page: force reveal + safe stars ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/prompts/[slug]/page.tsx'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('PromptReveal')) {
  s = s.replace(
    "import SafeImg from '@/components/safe-img'",
    "import SafeImg from '@/components/safe-img'\nimport PromptReveal from '@/components/prompt-reveal'"
  )
}

// robustly remove static prompt block
const blockRe = /<div className="mt-8 rounded-2xl border border-gold\/40[\s\S]*?<\/div>\s*<\/div>/
if (blockRe.test(s) && !s.includes('<PromptReveal')) {
  s = s.replace(
    blockRe,
    `<PromptReveal
            slug={item.slug}
            revealLabel={L(locale, 'نمایش پرامپت', 'Reveal Prompt')}
            copyLabel={L(locale, 'کپی پرامپت', 'Copy Prompt')}
            copiedLabel={L(locale, 'کپی شد!', 'Copied!')}
            hint={L(locale, 'پرامپت برای محافظت در برابر اسکرپینگ، فقط بعد از کلیک نمایش داده می‌شود.', 'The prompt is revealed on click to protect against scraping.')}
          />`
  )
}

s = s.replace('initial={item.stars}', 'initial={(item as any).stars ?? 0}')

fs.writeFileSync(p, s)
console.log('✅ detail: reveal enforced + stars safe. PromptReveal present:', s.includes('<PromptReveal'))
NODEEOF

echo "✅ update39 done!"