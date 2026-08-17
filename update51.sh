#!/bin/bash
set -e

# ---------- 1) schema: Notification + Comment replies ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'prisma/schema.prisma'
let s = fs.readFileSync(p, 'utf8')
let changed = false

if (!s.includes('model Notification')) {
  s += '\nmodel Notification {\n  id        String   @id @default(cuid())\n  userId    String\n  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)\n  type      String\n  text      String\n  url       String\n  read      Boolean  @default(false)\n  createdAt DateTime @default(now())\n}\n'
  changed = true
}

if (!s.includes('notifications Notification[]')) {
  s = s.replace('pushSubscriptions PushSubscription[]', 'pushSubscriptions PushSubscription[]\n  notifications   Notification[]')
  changed = true
}

if (!s.includes('parentId')) {
  s = s.replace(
    /model Comment \{([\s\S]*?)\n\}/,
    (m, inner) => m.replace(/\n\}$/, '\n  parentId  String?\n  parent    Comment?  @relation(\'thread\', fields: [parentId], references: [id], onDelete: Cascade)\n  children  Comment[] @relation(\'thread\')\n}')
  )
  changed = true
}

if (changed) { fs.writeFileSync(p, s); console.log('✅ schema: Notification + replies added') }
else console.log('⚠️ schema already complete')
NODEEOF

# ---------- 2) notify helper ----------
cat > src/lib/notify.ts << 'EOF'
import { prisma } from '@/lib/db'

export async function notify(userId: string, type: string, text: string, url: string) {
  try {
    await prisma.notification.create({ data: { userId, type, text, url } })
    await fetch((process.env.NEXT_PUBLIC_APP_URL ?? '') + '/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title: 'PromptsFA', body: text, url }),
    }).catch(() => {})
  } catch {}
}
EOF

# ---------- 3) gemini: real mime + option ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/gemini.ts'
let s = fs.readFileSync(p, 'utf8')
s = s.replace(
  'imgBase64: string | null',
  'imgBase64: string | null\n  imgMime?: string'
)
s = s.replace(
  "if (opts.imgBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: opts.imgBase64 } })",
  "if (opts.imgBase64) parts.push({ inline_data: { mime_type: opts.imgMime || 'image/jpeg', data: opts.imgBase64 } })"
)
fs.writeFileSync(p, s)
console.log('✅ gemini: mime support')
NODEEOF

# ---------- 4) cron telegram: image fallback ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/telegram/route.ts'
let s = fs.readFileSync(p, 'utf8')
const old = `    const ai = await analyzeWithGemini({
      text: promptText || '(no text — describe the image as a prompt idea)',
      imgBase64,
      categories,
    })`
const nw = `    let ai
    try {
      ai = await analyzeWithGemini({
        text: promptText || '(no text — describe the image as a prompt idea)',
        imgBase64,
        imgMime: imgType,
        categories,
      })
    } catch (e1) {
      ai = await analyzeWithGemini({
        text: promptText || '(no text — describe the image as a prompt idea)',
        imgBase64: null,
        categories,
      })
    }`
if (s.includes(old)) { s = s.replace(old, nw); fs.writeFileSync(p, s); console.log('✅ cron: image fallback') }
else console.log('❌ cron pattern not found')
NODEEOF

# ---------- 5) article route with correct Article fields ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/article/route.ts'
let s = fs.readFileSync(p, 'utf8')

const oldCreate = `      tagFa: (a.tagsFa ?? ['آموزش'])[0] ?? 'آموزش',
      tagEn: 'tutorial',
      contentFa: bodyHtml,`
const newCreate = `      tagFa: (a.tagsFa ?? ['آموزش'])[0] ?? 'آموزش',
      tagEn: 'tutorial',
      dateFa: new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'long' }).format(new Date()),
      dateEn: today,
      readFa: Math.max(2, Math.ceil((bodyHtml.length / 1500))) + ' دقیقه مطالعه',
      readEn: '5 min read',
      contentFa: [bodyHtml],
      contentEn: [bodyHtml],`

if (s.includes(oldCreate)) {
  s = s.replace(oldCreate, newCreate)
  s = s.replace('contentFa: bodyHtml,', '')
  fs.writeFileSync(p, s)
  console.log('✅ article: correct fields')
} else if (s.includes('contentFa: [bodyHtml]')) {
  console.log('⚠️ article already fixed')
} else {
  console.log('❌ article create pattern not found')
}
NODEEOF

# ---------- 6) blog detail: join array body ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/blog/[slug]/page.tsx'
let s = fs.readFileSync(p, 'utf8')
s = s.replace(
  "const body = (a as any).contentFa ?? ''",
  "const rawBody = (a as any).contentFa ?? ''\n  const body = Array.isArray(rawBody) ? rawBody.join('\\n') : rawBody"
)
fs.writeFileSync(p, s)
console.log('✅ blog detail: array body')
NODEEOF

# ---------- 7) likes route + notification ----------
cat > src/app/api/likes/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { notify } from '@/lib/notify'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 })

  const { promptId, action } = await req.json()
  if (!promptId || !['like', 'unlike'].includes(action)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const userId = session.user.id

  if (action === 'like') {
    await prisma.like.create({ data: { userId, promptId } }).catch(() => {})
    await prisma.prompt.update({ where: { id: promptId }, data: { likes: { increment: 1 } } }).catch(() => {})

    const p = await prisma.prompt.findUnique({ where: { id: promptId }, select: { userId: true, slug: true, titleFa: true } })
    if (p?.userId && p.userId !== userId) {
      await notify(p.userId, 'LIKE', '❤️ یک نفر پرامپت «' + p.titleFa + '» را پسندید', '/prompts/' + p.slug)
    }
  } else {
    await prisma.like.delete({ where: { userId_promptId: { userId, promptId } } }).catch(() => {})
    await prisma.prompt.update({ where: { id: promptId }, data: { likes: { decrement: 1 } } }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
EOF

# ---------- 8) comments route + replies + notifications ----------
cat > src/app/api/comments/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { notify } from '@/lib/notify'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 })

  const { text, targetId, targetType, parentId } = await req.json()
  if (!text || !targetId || !['prompt', 'article'].includes(targetType)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const data: any = {
    name: session.user.name ?? 'کاربر',
    text,
    userId: session.user.id,
  }
  if (parentId) data.parentId = parentId
  if (targetType === 'prompt') data.promptId = targetId
  if (targetType === 'article') data.articleId = targetId

  const comment = await prisma.comment.create({ data, include: { user: true } })

  // notifications
  if (targetType === 'prompt') {
    const p = await prisma.prompt.findUnique({ where: { id: targetId }, select: { userId: true, slug: true, titleFa: true } })
    if (p?.userId && p.userId !== session.user.id) {
      await notify(p.userId, 'COMMENT', '💬 دیدگاه جدید روی پرامپت «' + p.titleFa + '»', '/prompts/' + p.slug)
    }
    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId }, select: { userId: true } })
      if (parent?.userId && parent.userId !== session.user.id && parent.userId !== p?.userId) {
        await notify(parent.userId, 'REPLY', '↩️ پاسخی به دیدگاه تو داده شد', p ? '/prompts/' + p.slug : '/')
      }
    }
  }

  return NextResponse.json({
    id: comment.id,
    parentId: comment.parentId ?? null,
    name: session.user.name ?? 'کاربر',
    image: session.user.image ?? null,
    text: comment.text,
    createdAt: new Date(comment.createdAt).toLocaleString('fa-IR'),
  })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const targetId = searchParams.get('id')
  const targetType = searchParams.get('type')

  if (!targetId || !['prompt', 'article'].includes(targetType ?? '')) {
    return NextResponse.json([], { status: 400 })
  }

  const where: any = {}
  if (targetType === 'prompt') where.promptId = targetId
  if (targetType === 'article') where.articleId = targetId

  const comments = await prisma.comment.findMany({ where, orderBy: { createdAt: 'desc' }, include: { user: true } })

  return NextResponse.json(
    comments.map((c) => ({
      id: c.id,
      parentId: c.parentId ?? null,
      name: c.user?.name ?? c.name,
      image: c.user?.image ?? null,
      text: c.text,
      createdAt: new Date(c.createdAt).toLocaleString('fa-IR'),
    }))
  )
}
EOF

# ---------- 9) comment box with replies ----------
cat > src/components/real-comment-box.tsx << 'EOF'
'use client'

import { useState } from 'react'

type Comment = {
  id: string
  parentId?: string | null
  name: string
  image?: string | null
  text: string
  createdAt: string
}

export default function RealCommentBox({
  initial,
  targetId,
  targetType,
  titleLabel,
  textPlaceholder,
  submitLabel,
  loginRequired,
  isLoggedIn,
}: {
  initial: Comment[]
  targetId: string
  targetType: 'prompt' | 'article'
  titleLabel: string
  textPlaceholder: string
  submitLabel: string
  loginRequired: string
  isLoggedIn: boolean
}) {
  const [list, setList] = useState<Comment[]>(initial)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    if (!isLoggedIn) {
      alert(loginRequired)
      window.location.href = '/login'
      return
    }
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), targetId, targetType, parentId: replyTo?.id ?? null }),
    })
    if (res.ok) {
      const c = await res.json()
      setList([c, ...list])
      setText('')
      setReplyTo(null)
    }
  }

  const roots = list.filter((c) => !c.parentId)
  const kids = (id: string) => list.filter((c) => c.parentId === id)

  const renderOne = (c: Comment, depth: number) => (
    <div key={c.id} className={depth > 0 ? 'mr-6 mt-3 rounded-xl border border-line/60 bg-elevated/60 p-4' : 'rounded-xl border border-line bg-elevated p-4'}>
      <div className="flex items-center gap-3">
        {c.image ? (
          <img src={c.image} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gold/20 text-xs font-bold text-gold-bright">{c.name[0]}</div>
        )}
        <div>
          <p className="text-xs font-bold text-gold-bright">{c.name}</p>
          <p className="text-[10px] text-ink-faint">{c.createdAt}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-ink-muted">{c.text}</p>
      <button type="button" onClick={() => setReplyTo(c)} className="mt-2 text-[11px] text-ink-faint transition-colors hover:text-gold-bright">
        ↩️ پاسخ
      </button>
      {kids(c.id).map((k) => renderOne(k, depth + 1))}
    </div>
  )

  return (
    <div className="card mt-10 p-6">
      <h3 className="font-display text-lg font-bold">{titleLabel}</h3>

      <form className="mt-5 space-y-3" onSubmit={submit}>
        {replyTo && (
          <p className="text-[11px] text-gold-bright">
            در پاسخ به «{replyTo.name}»{' '}
            <button type="button" onClick={() => setReplyTo(null)} className="text-ink-faint hover:text-danger">✕ انصراف</button>
          </p>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={textPlaceholder}
          rows={3}
          className="input resize-none"
        />
        <button type="submit" className="btn-primary">{submitLabel}</button>
      </form>

      <div className="mt-6 space-y-4">{roots.map((c) => renderOne(c, 0))}</div>
    </div>
  )
}
EOF

# ---------- 10) notifications API ----------
mkdir -p src/app/api/notifications/read
cat > src/app/api/notifications/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ items: [], unread: 0 })

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: 'desc' }, take: 15 }),
    prisma.notification.count({ where: { userId: session.user.id, read: false } }),
  ])

  return NextResponse.json({
    items: items.map((n) => ({
      id: n.id,
      text: n.text,
      url: n.url,
      read: n.read,
      createdAt: new Date(n.createdAt).toLocaleString('fa-IR'),
    })),
    unread,
  })
}
EOF

cat > src/app/api/notifications/read/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  await prisma.notification.updateMany({ where: { userId: session.user.id, read: false }, data: { read: true } })
  return NextResponse.json({ ok: true })
}
EOF

# ---------- 11) notif bell ----------
cat > src/components/notif-bell.tsx << 'EOF'
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type N = { id: string; text: string; url: string; read: boolean; createdAt: string }

export default function NotifBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<N[]>([])
  const [unread, setUnread] = useState(0)

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

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      setUnread(0)
      await fetch('/api/notifications/read', { method: 'POST' }).catch(() => {})
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={toggle} className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-elevated text-ink-muted transition-colors hover:text-gold-bright" aria-label="اعلان‌ها">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -left-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-12 z-50 w-80 max-w-[85vw] rounded-2xl border border-line bg-[#0a0805] p-3 shadow-2xl">
          <p className="px-2 pb-2 text-xs font-bold text-gold-bright">اعلان‌ها</p>
          {items.length === 0 ? (
            <p className="px-2 pb-2 text-[11px] text-ink-faint">اعلانی نداری.</p>
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

# ---------- 12) header: bell ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/header.tsx'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('NotifBell')) {
  s = s.replace("import LogoutButton from '@/components/logout-button'", "import LogoutButton from '@/components/logout-button'\nimport NotifBell from '@/components/notif-bell'")
  s = s.replace('<LocaleSwitcher />', '<NotifBell />\n          <LocaleSwitcher />')
  fs.writeFileSync(p, s)
  console.log('✅ header: bell added')
} else console.log('⚠️ bell already present')
NODEEOF

# ---------- 13) remove anti-scraping hint text ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/prompt-reveal.tsx'
let s = fs.readFileSync(p, 'utf8')
s = s.replace(/.*<p className="mt-4 text-\[11px\] leading-6 text-ink-faint">\{hint\}<\/p>\n/, '')
fs.writeFileSync(p, s)
console.log('✅ hint removed')
NODEEOF

# ---------- 14) mobile menu: fixed sheet ----------
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
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(!open)} className="btn-secondary px-3 py-1.5" aria-label="منو">
        ☰
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-3 top-20 z-50 rounded-2xl border border-line bg-[#0a0805] p-5 shadow-2xl">
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
        </>
      )}
    </div>
  )
}
EOF

# ---------- 15) share icon like other sites ----------
cat > src/components/share-buttons.tsx << 'EOF'
'use client'

import { useState } from 'react'

export default function ShareButtons({ title, desc }: { title: string; desc: string }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = window.location.href
    const text = '✨ ' + title + (desc ? '\n' + desc : '')
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try { await (navigator as any).share({ title: '✨ ' + title, text, url }); return } catch { return }
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
      <button type="button" onClick={share} className="btn-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        اشتراک
      </button>
      <button type="button" onClick={copy} className="btn-secondary" title="کپی لینک">
        {copied ? '✅' : '🔗'}
      </button>
    </div>
  )
}
EOF

echo "✅ update51 done!"