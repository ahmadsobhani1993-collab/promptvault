#!/bin/bash
set -e

mkdir -p src/app/api/stars

# add stars field to schema
node << 'NODEEOF'
const fs = require('fs')
const p = 'prisma/schema.prisma'
let s = fs.readFileSync(p, 'utf8')
const old = '  likes      Int          @default(0)'
if (s.includes(old) && !s.includes('stars')) {
  s = s.replace(old, old + '\n  stars      Int          @default(0)')
  fs.writeFileSync(p, s)
  console.log('✅ schema: stars added')
} else {
  console.log('⚠️ schema pattern not changed')
}
NODEEOF

cat > src/components/tag-filter.tsx << 'EOF'
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function TagFilter({
  all,
  top,
  selected,
}: {
  all: string[]
  top: string[]
  selected: string[]
}) {
  const router = useRouter()
  const [q, setQ] = useState('')

  const apply = (tags: string[]) => {
    const query = new URLSearchParams(window.location.search)
    if (tags.length) query.set('tags', tags.join(','))
    else query.delete('tags')
    router.push('/explore?' + query.toString())
  }

  const toggle = (t: string) => {
    if (selected.includes(t)) apply(selected.filter((x) => x !== t))
    else if (selected.length < 2) apply([...selected, t])
  }

  const matches = q.trim() ? all.filter((t) => t.includes(q.trim())).slice(0, 10) : []
  const show = q.trim() ? matches : top

  return (
    <div className="mt-6">
      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-muted">فیلترهای فعال:</span>
          {selected.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className="flex items-center gap-1.5 rounded-full border border-gold bg-gold/15 px-3 py-1 text-xs text-gold-bright transition-colors hover:bg-gold/25"
            >
              {t}
              <span className="text-sm font-bold leading-none">×</span>
            </button>
          ))}
          <button type="button" onClick={() => apply([])} className="text-xs text-ink-faint transition-colors hover:text-danger">
            پاک کردن همه
          </button>
        </div>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="جستجوی تگ... (بقیه تگ‌ها را تایپ کن)"
        className="input max-w-xs"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {show.map((t) => {
          const active = selected.includes(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className={
                'rounded-full border px-3 py-1 text-xs transition-colors ' +
                (active
                  ? 'border-gold bg-gold/15 text-gold-bright'
                  : 'border-line bg-elevated text-ink-muted hover:border-gold/40 hover:text-gold-bright')
              }
            >
              {t}
            </button>
          )
        })}
        {q.trim() && show.length === 0 && (
          <span className="text-xs text-ink-faint">تگی یافت نشد.</span>
        )}
      </div>
    </div>
  )
}
EOF

cat > src/components/tag-picker.tsx << 'EOF'
'use client'

import { useState } from 'react'

export default function TagPicker({ vocab, max = 4 }: { vocab: { fa: string; en: string }[]; max?: number }) {
  const [sel, setSel] = useState<number[]>([])
  const [q, setQ] = useState('')

  const list = q.trim()
    ? vocab.map((v, i) => ({ v, i })).filter(({ v }) => v.fa.includes(q.trim()) || v.en.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 10)
    : vocab.map((v, i) => ({ v, i })).slice(0, 12)

  const toggle = (i: number) => {
    setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : s.length < max ? [...s, i] : s))
  }

  return (
    <div className="grid gap-3">
      <input type="hidden" name="tagsFa" value={sel.map((i) => vocab[i].fa).join('، ')} />
      <input type="hidden" name="tagsEn" value={sel.map((i) => vocab[i].en).join(', ')} />

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="جستجوی تگ مجاز... (حداکثر " + max + ')'
        className="input"
      />

      {sel.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sel.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              className="flex items-center gap-1.5 rounded-full border border-gold bg-gold/15 px-3 py-1 text-xs text-gold-bright"
            >
              {vocab[i].fa}
              <span className="text-sm font-bold leading-none">×</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {list.map(({ v, i }) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={
              'rounded-full border px-3 py-1 text-xs transition-colors ' +
              (sel.includes(i)
                ? 'border-gold bg-gold/15 text-gold-bright'
                : 'border-line bg-elevated text-ink-muted hover:border-gold/40')
            }
          >
            {v.fa}
          </button>
        ))}
      </div>
    </div>
  )
}
EOF

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
  const [count, setCount] = useState(initial)
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
      setCount(j.stars)
    }
  }

  return (
    <button
      type="button"
      onClick={give}
      className={starred ? 'btn-primary' : 'btn-secondary'}
      title={label}
    >
      <svg viewBox="0 0 24 24" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
      </svg>
      {count} {label}
    </button>
  )
}
EOF

cat > src/app/api/stars/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  const { promptId } = await req.json()
  if (!promptId) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const p = await prisma.prompt.update({
    where: { id: promptId },
    data: { stars: { increment: 1 } },
  })

  return NextResponse.json({ ok: true, stars: p.stars })
}
EOF

cat > src/app/explore/page.tsx << 'EOF'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { getPrompts, promptTypes, L } from '@/lib/data'
import { TAG_VOCAB } from '@/lib/gemini'
import { prisma } from '@/lib/db'
import PromptCard from '@/components/prompt-card'
import TagFilter from '@/components/tag-filter'

export const metadata = { title: 'کاوش', description: 'جستجو و فیلتر پرامپت‌ها' }
export const dynamic = 'force-dynamic'

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; tags?: string }>
}) {
  const params = await searchParams
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const selectedTags = (params.tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 2)

  const prompts = await getPrompts({ type: params.type, q: params.q, tags: selectedTags })

  const allTagsRows = await prisma.prompt.findMany({
    where: { status: 'PUBLISHED' },
    select: { tagsFa: true },
  })
  const freq: Record<string, number> = {}
  for (const r of allTagsRows) for (const t of r.tagsFa) freq[t] = (freq[t] ?? 0) + 1
  const top = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map((e) => e[0])

  return (
    <section className="container-app py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {L(locale, 'کاوش', 'Explore')}
      </h1>

      <form action="/explore" className="mt-6 max-w-2xl">
        <input
          name="q"
          defaultValue={params.q ?? ''}
          placeholder={L(locale, 'جستجو در پرامپت‌ها...', 'Search prompts...')}
          className="input text-base"
        />
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/explore"
          className={'rounded-full border px-4 py-1.5 text-xs ' + (!params.type ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted')}
        >
          {L(locale, 'همه', 'All')}
        </Link>
        {promptTypes.map((tp) => (
          <Link
            key={tp.value}
            href={'/explore?type=' + tp.value}
            className={'rounded-full border px-4 py-1.5 text-xs ' + (params.type === tp.value ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted')}
          >
            {L(locale, tp.fa, tp.en)}
          </Link>
        ))}
      </div>

      <TagFilter all={TAG_VOCAB.map((t) => t.fa)} top={top.length ? top : TAG_VOCAB.slice(0, 8).map((t) => t.fa)} selected={selectedTags} />

      {prompts.length > 0 ? (
        <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
          {prompts.map((item) => (
            <PromptCard key={item.id} item={item} locale={locale} cornerTags={selectedTags} />
          ))}
        </div>
      ) : (
        <div className="card mt-10 p-10 text-center text-sm text-ink-muted">
          {L(locale, 'نتیجه‌ای پیدا نشد.', 'No results found.')}
        </div>
      )}
    </section>
  )
}
EOF

cat > src/app/submit/page.tsx << 'EOF'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { type Locale } from '@/lib/i18n'
import { L } from '@/lib/data'
import { TAG_VOCAB } from '@/lib/gemini'
import TagPicker from '@/components/tag-picker'
import { createSubmit } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'ارسال پرامپت' }

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>
}) {
  const { done } = await searchParams
  const session = await auth()
  if (!session?.user) redirect('/login')

  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const categories = await prisma.category.findMany({ include: { subs: true } })

  return (
    <section className="container-app max-w-3xl py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {L(locale, 'ارسال پرامپت', 'Submit Prompt')}
      </h1>
      <p className="mt-3 text-sm leading-7 text-ink-muted">
        {L(
          locale,
          'پرامپت تو بعد از بررسی و تأیید ادمین، در سایت منتشر می‌شود و به نام تو ثبت خواهد شد.',
          'Your prompt will be published under your name after admin approval.'
        )}
      </p>

      {done && (
        <div className="glow-gold mt-6 rounded-2xl border border-success/40 bg-success/10 p-5 text-sm text-success">
          {L(
            locale,
            '✅ پرامپت تو با موفقیت ثبت شد و در صف بررسی است. بعد از تأیید، در سایت نمایش داده می‌شود.',
            '✅ Your prompt was submitted and is pending review.'
          )}
        </div>
      )}

      <form action={createSubmit} className="card mt-8 grid gap-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="titleFa" placeholder={L(locale, 'عنوان فارسی *', 'Persian title *')} className="input" required />
          <input name="titleEn" placeholder={L(locale, 'عنوان انگلیسی (اختیاری)', 'English title (optional)')} className="input" />
        </div>

        <input name="img" placeholder={L(locale, 'آدرس تصویر خروجی (https://...) *', 'Output image URL *')} className="input" required />

        <div className="grid gap-4 sm:grid-cols-3">
          <input name="model" placeholder={L(locale, 'مدل AI (Midjourney...) *', 'AI model *')} className="input" required />
          <select name="type" className="input">
            <option value="IMAGE">{L(locale, 'تصویر', 'Image')}</option>
            <option value="VIDEO">{L(locale, 'ویدیو', 'Video')}</option>
            <option value="TEXT">{L(locale, 'متن', 'Text')}</option>
            <option value="CODE">{L(locale, 'کد', 'Code')}</option>
            <option value="AUDIO">{L(locale, 'موسیقی', 'Music')}</option>
          </select>
          <select name="categoryId" className="input" required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{L(locale, c.nameFa, c.nameEn)}</option>
            ))}
          </select>
        </div>

        <select name="subId" className="input">
          <option value="">{L(locale, 'بدون زیردسته', 'No subcategory')}</option>
          {categories.flatMap((c) => c.subs).map((s) => (
            <option key={s.id} value={s.id}>{L(locale, s.fa, s.en)}</option>
          ))}
        </select>

        <div>
          <p className="mb-2 text-xs font-bold text-gold-bright">
            {L(locale, 'تگ‌ها (فقط از لیست مجاز — حداکثر ۴)', 'Tags (choose from list — max 4)')}
          </p>
          <TagPicker vocab={TAG_VOCAB} max={4} />
        </div>

        <textarea
          name="prompt"
          placeholder={L(locale, 'متن کامل پرامپت *', 'Full prompt text *')}
          rows={7}
          className="input resize-none font-mono"
          dir="ltr"
          required
        />

        <textarea
          name="usageFa"
          placeholder={L(locale, 'راهنمای استفاده (فارسی): مثلا در کدام مدل بگذارم، چه پارامترهایی بزنم، نکات مهم...', 'How to use (Persian)...')}
          rows={3}
          className="input resize-none"
        />

        <textarea
          name="usageEn"
          placeholder="How to use (English): which model, parameters, tips..."
          rows={3}
          className="input resize-none"
          dir="ltr"
        />

        <button type="submit" className="btn-primary w-fit">
          {L(locale, 'ارسال برای بررسی', 'Submit for review')}
        </button>
      </form>
    </section>
  )
}
EOF

cat > src/components/layout/footer.tsx << 'EOF'
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-line/70 bg-[#0a0805]">
      <div className="container-app grid gap-10 py-14 md:grid-cols-2">
        <div>
          <p className="font-display text-lg font-extrabold tracking-tight">
            Prompts<span className="text-gold-bright">FA</span>
          </p>
          <p className="mt-3 text-sm leading-7 text-ink-muted">
            ما را در شبکه‌های اجتماعی دنبال کنید:
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="https://t.me/prompts_fa" target="_blank" rel="noreferrer" className="btn-secondary">
              📣 تلگرام: @prompts_fa
            </a>
            <a href="https://instagram.com/prompts_fa" target="_blank" rel="noreferrer" className="btn-secondary">
              📸 اینستاگرام: @prompts_fa
            </a>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold text-gold-bright">همکار ما</p>
          <a
            href="https://finsoph.ir"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-lg font-extrabold transition-colors hover:text-gold-bright"
          >
            فینسوف | Finsoph
          </a>
          <p className="mt-2 text-sm leading-7 text-ink-muted">
            وب‌سایت دوست و همکار ما؛ مرجع آموزش و ابزارهای هوش مصنوعی.
          </p>
          <a
            className="mt-3 inline-block text-xs text-gold-bright hover:text-gold"
            href="https://finsoph.ir"
            target="_blank"
            rel="noreferrer"
          >
            مشاهده وب‌سایت ←
          </a>
        </div>
      </div>

      <div className="border-t border-line/50 py-5 text-center text-[11px] text-ink-faint">
        © {new Date().getFullYear()} PromptsFA — همه حقوق محفوظ است.
      </div>
    </footer>
  )
}
EOF

# patch prompt detail: SafeImg + StarButton
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/prompts/[slug]/page.tsx'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes("import StarButton")) {
  s = s.replace(
    "import SaveButton from '@/components/save-button'",
    "import SaveButton from '@/components/save-button'\nimport StarButton from '@/components/star-button'\nimport SafeImg from '@/components/safe-img'"
  )
}

s = s.replace(
  '<img src={item.img} alt={L(locale, item.titleFa, item.titleEn)} className="glow-gold w-full rounded-2xl object-cover" />',
  '<SafeImg src={item.img} alt={L(locale, item.titleFa, item.titleEn)} className="glow-gold w-full rounded-2xl object-cover" loading="eager" />'
)

if (!s.includes('StarButton promptId')) {
  s = s.replace(
    "requireLogin={L(locale, 'برای ذخیره کردن ابتدا وارد شو', 'Login to save')} />",
    "requireLogin={L(locale, 'برای ذخیره کردن ابتدا وارد شو', 'Login to save')} />\n            <StarButton promptId={item.id} initial={item.stars} label={L(locale, 'ستاره', 'stars')} />"
  )
}

fs.writeFileSync(p, s)
console.log('✅ detail page patched (SafeImg + StarButton)')
NODEEOF

echo "✅ Smart tag filter + tag picker + guest stars + footer + mobile images!"