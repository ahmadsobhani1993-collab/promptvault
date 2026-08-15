#!/bin/bash
set -e

mkdir -p src/app/api/prompt-content

# ---------- 1) Prompt hidden from initial HTML (anti-scraping) ----------
cat > src/app/api/prompt-content/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const hits = new Map<string, number[]>()

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const now = Date.now()
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000)
  if (arr.length >= 30) return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  arr.push(now)
  hits.set(ip, arr)

  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const p = await prisma.prompt.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: { prompt: true },
  })
  if (!p) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({ prompt: p.prompt })
}
EOF

cat > src/components/prompt-reveal.tsx << 'EOF'
'use client'

import { useState } from 'react'
import CopyButton from '@/components/copy-button'

export default function PromptReveal({
  slug,
  revealLabel,
  copyLabel,
  copiedLabel,
  hint,
}: {
  slug: string
  revealLabel: string
  copyLabel: string
  copiedLabel: string
  hint: string
}) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const reveal = async () => {
    if (text || loading) return
    setLoading(true)
    const res = await fetch('/api/prompt-content?slug=' + encodeURIComponent(slug))
    if (res.ok) {
      const j = await res.json()
      setText(j.prompt)
    }
    setLoading(false)
  }

  if (!text) {
    return (
      <div className="mt-8 rounded-2xl border border-gold/40 bg-[#0d0b07] p-6 text-center">
        <div className="mx-auto h-20 max-w-md space-y-2 opacity-60" aria-hidden>
          <div className="h-3 rounded bg-[#241b0d]" />
          <div className="h-3 w-4/5 rounded bg-[#241b0d]" />
          <div className="h-3 w-3/5 rounded bg-[#241b0d]" />
        </div>
        <p className="mt-4 text-[11px] leading-6 text-ink-faint">{hint}</p>
        <button type="button" onClick={reveal} className="btn-primary mt-4">
          {loading ? '...' : revealLabel}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-8 rounded-2xl border border-gold/40 bg-[#0d0b07] p-5">
      <p className="text-xs font-bold text-gold-bright">Prompt</p>
      <p dir="ltr" className="mt-3 text-left font-mono text-sm leading-7 text-[#e8d9ae]">{text}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <CopyButton text={text} label={copyLabel} copiedLabel={copiedLabel} />
        <span className="text-[10px] text-ink-faint">کپی شد؟ برو امتحانش کن:</span>
        <a className="badge hover:border-gold/60 hover:text-gold-bright" target="_blank" rel="noreferrer" href="https://chat.openai.com">ChatGPT</a>
        <a className="badge hover:border-gold/60 hover:text-gold-bright" target="_blank" rel="noreferrer" href="https://www.midjourney.com">Midjourney</a>
        <a className="badge hover:border-gold/60 hover:text-gold-bright" target="_blank" rel="noreferrer" href="https://gemini.google.com">Gemini</a>
      </div>
    </div>
  )
}
EOF

# ---------- 2) Header with proper category dropdown ----------
cat > src/components/locale-switcher.tsx << 'EOF'
'use client'

export default function LocaleSwitcher() {
  const set = (v: string) => {
    document.cookie = 'locale=' + v + '; path=/; max-age=31536000'
    window.location.reload()
  }
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-elevated px-1.5 py-1 text-[10px]">
      <button type="button" onClick={() => set('fa')} className="rounded-full px-2 py-0.5 transition-colors hover:text-gold-bright">فا</button>
      <button type="button" onClick={() => set('en')} className="rounded-full px-2 py-0.5 transition-colors hover:text-gold-bright">EN</button>
    </div>
  )
}
EOF

cat > src/components/layout/header.tsx << 'EOF'
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
          <Link href="/creators" className="transition-colors hover:text-gold-bright">{L(locale, 'سازندگان', 'Creators')}</Link>
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

# ---------- 3) Hero with big search bar ----------
cat > src/components/hero.tsx << 'EOF'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n'

export default function Hero({
  locale,
  label,
  title,
  subtitle,
  placeholder,
  chips,
}: {
  locale: Locale
  label: string
  title: string
  subtitle: string
  placeholder: string
  chips: { fa: string; en: string; href: string }[]
}) {
  return (
    <section className="relative flex min-h-[92vh] items-center justify-center overflow-hidden py-20">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="fx-blob anim-float" style={{ top: '-10%', right: '-10%', width: '40vw', height: '40vw' }} />
        <div className="fx-blob anim-float2" style={{ bottom: '-15%', left: '-10%', width: '36vw', height: '36vw' }} />
      </div>

      <div className="container-app relative text-center">
        <p className="gold-badge mx-auto w-fit anim-fade-up">{label}</p>
        <h1 className="anim-fade-up mx-auto mt-6 max-w-3xl font-display text-4xl font-black leading-tight md:text-6xl" style={{ animationDelay: '120ms' }}>
          {title}
        </h1>
        <p className="anim-fade-up mx-auto mt-5 max-w-xl text-sm leading-8 text-ink-muted md:text-base" style={{ animationDelay: '240ms' }}>
          {subtitle}
        </p>

        <form action="/explore" className="anim-fade-up mx-auto mt-10 max-w-2xl" style={{ animationDelay: '360ms' }}>
          <div className="glow-gold flex items-center gap-3 rounded-2xl border border-gold/40 bg-elevated px-5 py-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0 text-gold-bright">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              name="q"
              placeholder={placeholder}
              className="w-full bg-transparent text-base outline-none placeholder:text-ink-faint"
            />
            <button type="submit" className="btn-primary shrink-0">
              {locale === 'fa' ? 'جستجو' : 'Search'}
            </button>
          </div>
        </form>

        <div className="anim-fade-up mt-6 flex flex-wrap justify-center gap-2" style={{ animationDelay: '480ms' }}>
          {chips.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="rounded-full border border-line bg-elevated px-4 py-1.5 text-xs text-ink-muted transition-colors hover:border-gold/50 hover:text-gold-bright"
            >
              {locale === 'fa' ? c.fa : c.en}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
EOF

# ---------- 4) PromptCard: new badge ----------
cat > src/components/prompt-card.tsx << 'EOF'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n'
import { L, getPromptTypeLabel } from '@/lib/data'
import SafeImg from '@/components/safe-img'

type PromptItem = {
  slug: string
  titleFa: string
  titleEn: string
  img: string
  model: string
  type: string
  tagsFa: string[]
  tagsEn: string[]
  likes: number
  saves: number
  views: number
  stars: number
}

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K'
  return String(n)
}

export default function PromptCard({
  item,
  locale,
  cornerTags,
  isNew,
}: {
  item: PromptItem
  locale: Locale
  cornerTags?: string[]
  isNew?: boolean
}) {
  const dead = item.likes + item.saves + item.views === 0
  return (
    <article className="card-cream glow-gold p-3 transition-transform hover:-translate-y-1">
      <Link href={'/prompts/' + item.slug} className="block">
        <div className="relative">
          <SafeImg src={item.img} alt={L(locale, item.titleFa, item.titleEn)} className="aspect-square w-full rounded-lg object-cover" />
          <span className="absolute right-2 top-2 rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold text-[#171512]">
            {getPromptTypeLabel(item.type, locale)}
          </span>
          {isNew && (
            <span className="absolute left-2 top-2 rounded-full bg-success px-2.5 py-0.5 text-[9px] font-bold text-[#0d1a10]">
              ✨ {L(locale, 'جدید', 'New')}
            </span>
          )}
          {cornerTags && cornerTags.length > 0 && (
            <span className="absolute bottom-2 left-2 flex flex-col items-start gap-1">
              {cornerTags.map((t) => (
                <span key={t} className="rounded-full bg-[#171512]/85 px-2 py-0.5 text-[9px] text-gold-bright">
                  {t}
                </span>
              ))}
            </span>
          )}
          <span className="glow-soft absolute -bottom-3 right-2 grid h-10 w-10 place-items-center rounded-full border border-gold bg-[#1b1408] text-[9px] font-bold text-gold-bright">
            {item.model}
          </span>
        </div>
        <h3 className="mt-4 line-clamp-1 text-sm font-bold text-[#171512]">
          {L(locale, item.titleFa, item.titleEn)}
        </h3>
      </Link>

      <div className="mt-2 flex flex-wrap gap-1">
        {item.tagsFa.map((tag, i) => L(locale, tag, item.tagsEn[i] ?? tag)).map((tag) => (
          <Link
            key={tag}
            href={'/explore?tags=' + encodeURIComponent(tag)}
            className="rounded-full bg-[#e7dcc4] px-2 py-0.5 text-[10px] text-[#5c5443] transition-colors hover:bg-gold hover:text-[#171512]"
          >
            {tag}
          </Link>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#e2d8c2] pt-2 text-[10px] text-[#6b6353]">
        {dead ? (
          <span className="text-[#8a8172]">{L(locale, 'منتظر اولین تعامل ✨', 'Awaiting first interaction ✨')}</span>
        ) : (
          <>
            <span>{fmt(item.likes)} {L(locale, 'پسند', 'likes')}</span>
            <span>{fmt(item.saves)} {L(locale, 'ذخیره', 'saves')}</span>
            <span>{fmt(item.views)} {L(locale, 'بازدید', 'views')}</span>
          </>
        )}
      </div>
    </article>
  )
}
EOF

# ---------- 5) data.ts: include user ----------
node << 'NODEEOF'
const fs = require('fs')
let s = fs.readFileSync('src/lib/data.ts', 'utf8')
s = s.replace(
  `export async function getPromptBySlug(slug: string) {
  return prisma.prompt.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: { category: true, sub: true },
  })
}`,
  `export async function getPromptBySlug(slug: string) {
  return prisma.prompt.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: { category: true, sub: true, user: true },
  })
}`
)
fs.writeFileSync('src/lib/data.ts', s)
console.log('✅ data.ts: user included')
NODEEOF

# ---------- 6) detail page patches ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/prompts/[slug]/page.tsx'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('PromptReveal')) {
  s = s.replace(
    "import SafeImg from '@/components/safe-img'",
    "import SafeImg from '@/components/safe-img'\nimport PromptReveal from '@/components/prompt-reveal'"
  )

  s = s.replace(
    `          <div className="mt-8 rounded-2xl border border-gold/40 bg-[#0d0b07] p-5">
            <p className="text-xs font-bold text-gold-bright">Prompt</p>
            <p dir="ltr" className="mt-3 text-left font-mono text-sm leading-7 text-[#e8d9ae]">{item.prompt}</p>
            <div className="mt-5">
              <CopyButton text={item.prompt} label={L(locale, 'کپی پرامپت', 'Copy Prompt')} copiedLabel={L(locale, 'کپی شد!', 'Copied!')} />
            </div>
          </div>`,
    `          <PromptReveal
            slug={item.slug}
            revealLabel={L(locale, 'نمایش پرامپت', 'Reveal Prompt')}
            copyLabel={L(locale, 'کپی پرامپت', 'Copy Prompt')}
            copiedLabel={L(locale, 'کپی شد!', 'Copied!')}
            hint={L(locale, 'پرامپت برای محافظت در برابر اسکرپینگ، فقط بعد از کلیک نمایش داده می‌شود.', 'The prompt is revealed on click to protect against scraping.') }
          />`
  )

  s = s.replace(
    `            <Link href={'/categories/' + item.category.slug} className="gold-badge transition-colors hover:bg-gold/25">
              {L(locale, item.category.nameFa, item.category.nameEn)}
            </Link>`,
    `            <Link href={'/categories/' + item.category.slug} className="gold-badge transition-colors hover:bg-gold/25">
              {L(locale, item.category.nameFa, item.category.nameEn)}
            </Link>
            {item.sub && (
              <Link href={'/categories/' + item.category.slug + '?sub=' + item.sub.slug} className="badge transition-colors hover:border-gold/60 hover:text-gold-bright">
                {L(locale, item.sub.fa, item.sub.en)}
              </Link>
            )}`
  )

  s = s.replace(
    `          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">
            {L(locale, item.titleFa, item.titleEn)}
          </h1>`,
    `          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">
            {L(locale, item.titleFa, item.titleEn)}
          </h1>

          <div className="mt-4 flex items-center gap-3">
            {item.user?.image ? (
              <img src={item.user.image} alt="" className="h-8 w-8 rounded-full" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gold/20 text-[10px] font-bold text-gold-bright">P</span>
            )}
            <div className="text-xs">
              <p className="font-bold">{item.user?.name ?? 'تیم PromptsFA'}</p>
              <p className="text-ink-faint">{L(locale, 'منتشرکننده', 'Creator')}</p>
            </div>
          </div>`
  )

  s = s.replace(
    `    </section>
  )
}`,
    `      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CreativeWork',
            name: item.titleFa,
            alternateName: item.titleEn,
            description: item.descFa ?? '',
            image: item.img,
            inLanguage: ['fa', 'en'],
            creator: { '@type': 'Person', name: item.user?.name ?? 'PromptsFA' },
            datePublished: item.createdAt,
          }),
        }}
      />
    </section>
  )
}`
  )

  fs.writeFileSync(p, s)
  console.log('✅ detail page: reveal + sub + creator + JSON-LD')
} else {
  console.log('⚠️ already patched')
}
NODEEOF

# ---------- 7) home: diverse trending + new badge ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/page.tsx'
let s = fs.readFileSync(p, 'utf8')

s = s.replace('getPrompts({ take: 5 })', 'getPrompts({ take: 12 })')

s = s.replace(
  `    getArticles(),
  ])`,
  `    getArticles(),
  ])

  const trending: typeof prompts = []
  for (const p of prompts) {
    if (trending.length >= 5) break
    if (!trending.some((d) => d.categoryId === p.categoryId)) trending.push(p)
  }
  for (const p of prompts) {
    if (trending.length >= 5) break
    if (!trending.includes(p)) trending.push(p)
  }`
)

s = s.replace(
  `{prompts.map((item, i) => (
                <Reveal key={item.id} delay={i * 90}>
                  <PromptCard item={item} locale={locale} />
                </Reveal>
              ))}`,
  `{trending.map((item, i) => (
                <Reveal key={item.id} delay={i * 90}>
                  <PromptCard item={item} locale={locale} isNew={Date.now() - new Date(item.createdAt).getTime() < 48 * 3600 * 1000} />
                </Reveal>
              ))}`
)

fs.writeFileSync(p, s)
console.log('✅ home: diverse trending + new badge')
NODEEOF

# ---------- 8) footer partner subtler ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/footer.tsx'
let s = fs.readFileSync(p, 'utf8')
s = s.replace(
  'className="mt-3 inline-block text-lg font-extrabold transition-colors hover:text-gold-bright"',
  'className="mt-2 inline-block text-sm font-bold text-ink-muted transition-colors hover:text-gold-bright"'
)
fs.writeFileSync(p, s)
console.log('✅ footer partner subtler')
NODEEOF

echo "✅ Anti-scraping + header/hero fix + detail fields + diverse trending + JSON-LD!"