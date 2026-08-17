#!/bin/bash
set -e

mkdir -p src/app/api/img/[id]

# ---------- schema: imgData ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'prisma/schema.prisma'
let s = fs.readFileSync(p, 'utf8')
const block = s.match(/model Prompt \{[\s\S]*?\n\}/)
if (block && !block[0].includes('imgData')) {
  s = s.replace(block[0], block[0].replace(/\n\}$/, '\n  imgData    String?\n  imgType    String?\n}'))
  fs.writeFileSync(p, s)
  console.log('✅ schema: imgData/imgType added')
} else console.log('⚠️ schema already has imgData')
NODEEOF

# ---------- image server route ----------
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

# ---------- telegram cron with self-hosted images ----------
cat > src/app/api/cron/telegram/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchPage, diagnoseChannel, verifyImage, tgSendText, tgSendPhoto, tgSendCode } from '@/lib/telegram'
import { analyzeWithGemini } from '@/lib/gemini'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60

const TG_FOOTER = '\n\n🔗 @Prompts_fa'
const APP = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'

async function getSetting(key: string, def: string) {
  const s = await prisma.setting.findUnique({ where: { key } })
  return s?.value ?? def
}

async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
}

function tehranNow() {
  const now = new Date()
  const hour = parseInt(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: 'numeric', hour12: false }).format(now),
    10
  )
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now)
  return { hour, date }
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const channel = process.env.TELEGRAM_CHANNEL
  if (!channel) return NextResponse.json({ error: 'no channel env' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  if (searchParams.get('debug') === '1') {
    return NextResponse.json({ debug: await diagnoseChannel(channel) })
  }

  const synced = await getSetting('tg_synced', '0')

  if (synced !== '1') {
    const start = Date.now()
    let before = parseInt(await getSetting('tg_before', '0'), 10)
    let total = 0
    for (let i = 0; i < 12; i++) {
      if (Date.now() - start > 40000) break
      const page = before === 0 ? await fetchPage(channel) : await fetchPage(channel, before)
      if (page.length === 0) { await setSetting('tg_synced', '1'); break }
      const minId = Math.min(...page.map((m) => m.id))
      await prisma.telegramQueue.createMany({
        data: page.map((m) => ({ id: m.id, text: m.text, img: m.img, reply: m.reply })),
        skipDuplicates: true,
      })
      total += page.length
      before = minId
      await setSetting('tg_before', String(before))
    }
    return NextResponse.json({ ok: true, phase: 'sync', added: total, synced: await getSetting('tg_synced', '0') })
  }

  const item = await prisma.telegramQueue.findFirst({ where: { status: 'PENDING' }, orderBy: { id: 'asc' } })
  if (!item) return NextResponse.json({ ok: true, phase: 'idle' })

  try {
    let promptText = (item.text ?? '').trim()
    let img = item.img
    const skipIds: number[] = []

    if (img && promptText.length < 40) {
      const next = await prisma.telegramQueue.findFirst({ where: { id: { gt: item.id }, status: 'PENDING' }, orderBy: { id: 'asc' } })
      if (next && !next.img && (next.text ?? '').length > 40) { promptText = (next.text ?? '').trim(); skipIds.push(next.id) }
    }

    if (!img && promptText && item.reply) {
      const prev = await prisma.telegramQueue.findFirst({ where: { id: { lt: item.id }, img: { not: null } }, orderBy: { id: 'desc' } })
      if (prev && prev.id >= item.id - 3) img = prev.img
    }

    if (!promptText && !img) {
      await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'SKIPPED' } })
      return NextResponse.json({ ok: true, phase: 'skip-empty' })
    }

    // download original image (for Gemini + self-host)
    let imgBase64: string | null = null
    let imgType = 'image/jpeg'
    if (img) {
      try {
        const ir = await fetch(img, { signal: AbortSignal.timeout(9000) })
        imgType = ir.headers.get('content-type') ?? 'image/jpeg'
        const buf = Buffer.from(await ir.arrayBuffer())
        if (buf.length > 0 && buf.length < 900_000) imgBase64 = buf.toString('base64')
      } catch {}
    }

    let finalImg: string | null = null
    if (img) {
      const wsrv = 'https://wsrv.nl/?url=' + encodeURIComponent(img) + '&w=900&q=75&output=webp'
      const st = 'https://cdn.statically.io/img/' + img.replace(/^https?:\/\//, '')
      if (await verifyImage(wsrv)) finalImg = wsrv
      else if (await verifyImage(st)) finalImg = st
    }

    if (!finalImg && !imgBase64) {
      await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'SKIPPED' } })
      for (const sid of skipIds) await prisma.telegramQueue.update({ where: { id: sid }, data: { status: 'SKIPPED' } })
      return NextResponse.json({ ok: true, phase: 'skip-no-image', id: item.id })
    }

    const categories = await prisma.category.findMany()
    const ai = await analyzeWithGemini({
      text: promptText || '(no text — describe the image as a prompt idea)',
      imgBase64,
      categories,
    })
    const cat = await prisma.category.findUnique({ where: { slug: ai.categorySlug } })
    const finalPrompt = (ai.promptEn || promptText).trim()

    const prompt = await prisma.prompt.create({
      data: {
        titleFa: ai.titleFa, titleEn: ai.titleEn, descFa: ai.descFa, descEn: ai.descEn,
        usageFa: ai.usageFa, usageEn: ai.usageEn,
        slug: 'tg-' + item.id,
        img: finalImg ?? 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop',
        model: /--v\s?\d|--ar/.test(finalPrompt) ? 'Midjourney' : 'AI',
        type: 'IMAGE', status: 'PUBLISHED',
        categoryId: cat?.id ?? categories[0].id,
        tagsFa: ai.tagsFa, tagsEn: ai.tagsEn, prompt: finalPrompt,
      },
    })

    // self-host if we downloaded the bytes
    if (imgBase64) {
      const selfUrl = APP() + '/api/img/' + prompt.id
      await prisma.prompt.update({ where: { id: prompt.id }, data: { imgData: imgBase64, imgType, img: selfUrl } })
      finalImg = selfUrl
    }

    await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'PROCESSED', promptId: prompt.id } })
    for (const sid of skipIds) await prisma.telegramQueue.update({ where: { id: sid }, data: { status: 'MERGED', promptId: prompt.id } })

    let tg: any = null
    const out = process.env.TELEGRAM_OUTPUT
    if (out && process.env.TELEGRAM_BOT_TOKEN) {
      const { hour, date } = tehranNow()
      const sentDate = await getSetting('tg_sent_date', '')
      let sentCount = sentDate === date ? parseInt(await getSetting('tg_sent_count', '0'), 10) : 0
      const inWindow = hour >= 12 && hour <= 23

      if (!inWindow) tg = { skipped: true, reason: 'outside window, hour=' + hour }
      else if (sentCount >= 24) tg = { skipped: true, reason: 'daily limit' }
      else {
        const tagLine = ai.tagsFa.map((t) => '#' + t.replace(/\s+/g, '_')).join(' ')
        const usageFa = (ai.usageFa || '').trim()
        const fullCaption = '✨ ' + ai.titleFa + '\n\n' + finalPrompt + '\n\n📘 ' + usageFa + '\n\n' + tagLine + TG_FOOTER
        const shortCaption = '✨ ' + ai.titleFa + '\n\n📘 ' + usageFa + '\n\n' + tagLine + TG_FOOTER
        if (fullCaption.length <= 1024) tg = { single: await tgSendPhoto(out, finalImg!, fullCaption) }
        else tg = { photo: await tgSendPhoto(out, finalImg!, shortCaption), code: await tgSendCode(out, finalPrompt, TG_FOOTER) }
        await setSetting('tg_sent_date', date)
        await setSetting('tg_sent_count', String(sentCount + 1))
      }
    }

    return NextResponse.json({ ok: true, phase: 'processed', id: item.id, slug: prompt.slug, selfHosted: !!imgBase64, tg })
  } catch (e: any) {
    await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'FAILED' } }).catch(() => {})
    return NextResponse.json({ ok: false, phase: 'failed', id: item.id, error: String(e?.message ?? e) }, { status: 500 })
  }
}
EOF

# ---------- article cron: robust JSON parse ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/article/route.ts'
let s = fs.readFileSync(p, 'utf8')
const old = `  const m = raw.match(/\\{[\\s\\S]*\\}/)
  if (!m) return NextResponse.json({ ok: false, error: 'no json from gemini' }, { status: 500 })
  const a = JSON.parse(m[0])`
const nw = `  let a: any
  try {
    const cleaned = raw.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '')
    const m = cleaned.match(/\\{[\\s\\S]*\\}/)
    if (!m) throw new Error('no json')
    a = JSON.parse(m[0])
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'json parse failed', raw: raw.slice(0, 300) }, { status: 500 })
  }`
if (s.includes(old)) { s = s.replace(old, nw); fs.writeFileSync(p, s); console.log('✅ article: robust parse') }
else if (s.includes('json parse failed')) console.log('⚠️ article already robust')
else console.log('❌ article parse pattern not found')
NODEEOF

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
      try { await navigator.share({ title: '✨ ' + title, text, url }); return } catch { return }
    }
    window.open('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text), '_blank')
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
      <button type="button" onClick={share} className="btn-primary">📤 اشتراک</button>
      <button type="button" onClick={copy} className="btn-secondary" title="کپی لینک">{copied ? '✅' : '🔗'}</button>
    </div>
  )
}
EOF

# ---------- header: clean + logout + left dropdown ----------
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
            <div className="invisible absolute right-0 top-full z-50 w-[26rem] pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
              <div className="card grid grid-cols-2 gap-4 p-5">
                {categories.map((c) => (
                  <div key={c.id} className="rounded-xl border border-line/60 bg-elevated/50 p-3 transition-colors hover:border-gold/40">
                    <Link href={'/categories/' + c.slug} className="flex items-center gap-2 text-sm font-bold text-ink transition-colors hover:text-gold-bright">
                      <span className="text-base">{c.icon}</span>
                      {L(locale, c.nameFa, c.nameEn)}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.subs.map((s) => (
                        <Link key={s.id} href={'/categories/' + c.slug + '?sub=' + s.slug} className="rounded-full bg-[#171512] px-2 py-0.5 text-[10px] text-ink-muted transition-colors hover:text-gold-bright">
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
                <Link href="/admin" className="btn-secondary hidden md:inline-flex">🛠 {L(locale, 'مدیریت', 'Admin')}</Link>
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

# ---------- detail: remove star, keep single share ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/prompts/[slug]/page.tsx'
let s = fs.readFileSync(p, 'utf8')

s = s.replace(/.*<StarButton[^>]*\/>\n/g, '')
s = s.replace("import StarButton from '@/components/star-button'\n", '')

if (!s.includes('ShareButtons')) {
  s = s.replace(
    "import PromptReveal from '@/components/prompt-reveal'",
    "import PromptReveal from '@/components/prompt-reveal'\nimport ShareButtons from '@/components/share-buttons'"
  )
  const anchor = '<div className="mt-5 flex flex-wrap gap-1">'
  if (s.includes(anchor)) {
    s = s.replace(anchor, `<div className="mt-5">
            <ShareButtons title={L(locale, item.titleFa, item.titleEn)} desc={L(locale, item.descFa ?? '', item.descEn ?? '')} />
          </div>

          <div className="mt-5 flex flex-wrap gap-1">`)
  }
}
fs.writeFileSync(p, s)
console.log('✅ detail: star removed, single share ready')
NODEEOF

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
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{L(locale, 'وبلاگ و آموزش', 'Blog')}</h1>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {articles.map((a) => (
          <Link key={a.id} href={'/blog/' + a.slug} className="card glow-gold overflow-hidden transition-transform hover:-translate-y-1">
            <SafeImg src={a.img} alt={L(locale, a.titleFa, a.titleEn)} className="aspect-video w-full object-cover" />
            <div className="p-5">
              <span className="gold-badge">{L(locale, a.tagFa, a.tagEn)}</span>
              <h2 className="mt-3 font-display text-lg font-extrabold">{L(locale, a.titleFa, a.titleEn)}</h2>
              <p className="mt-2 line-clamp-2 text-xs leading-6 text-ink-muted">{L(locale, a.descFa, a.descEn)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
EOF

echo "✅ update50 done!"