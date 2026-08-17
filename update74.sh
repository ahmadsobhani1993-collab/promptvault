#!/bin/bash
set -e

mkdir -p src/app/api/upload src/app/api/debug/set-storage

# ---------- 1) schema: UploadImage ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'prisma/schema.prisma'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('model UploadImage')) {
  s += '\nmodel UploadImage {\n  id     String @id @default(cuid())\n  fileId String\n  createdAt DateTime @default(now())\n}\n'
  fs.writeFileSync(p, s)
  console.log('✅ schema: UploadImage')
} else console.log('⚠️ UploadImage exists')
NODEEOF

# ---------- 2) global: white input text ----------
cat >> src/app/globals.css << 'EOF'

input, textarea { color: #ece5d3 !important; }
input::placeholder, textarea::placeholder { color: #9a9284 !important; }
EOF

# ---------- 3) notif bell + mobile menu: document click close ----------
cat > src/components/notif-bell.tsx << 'EOF'
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type N = { id: string; text: string; url: string; read: boolean; createdAt: string }

export default function NotifBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<N[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      setUnread(0)
      await fetch('/api/notifications/read', { method: 'POST' }).catch(() => {})
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={toggle} className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-elevated text-ink-muted transition-colors hover:text-gold-bright" aria-label="اعلان‌ها">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -left-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">{unread}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-50 rounded-2xl border border-line bg-[#0a0805] p-3 shadow-2xl sm:absolute sm:inset-x-auto sm:top-12 sm:left-0 sm:w-80">
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

cat > src/components/mobile-menu.tsx << 'EOF'
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export default function MobileMenu({
  links,
  admin,
}: {
  links: { href: string; label: string }[]
  admin: boolean
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
          </div>
        </div>
      )}
    </div>
  )
}
EOF

# ---------- 4) img route: telegram file redirect ----------
cat > 'src/app/api/img/[id]/route.ts' << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function tgFileUrl(fileId: string): Promise<string | null> {
  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  try {
    const r = await fetch('https://api.telegram.org/bot' + token + '/getFile?file_id=' + encodeURIComponent(fileId), { signal: AbortSignal.timeout(8000) })
    const j = await r.json()
    const path = j?.result?.file_path
    return path ? 'https://api.telegram.org/file/bot' + token + '/' + path : null
  } catch {
    return null
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const row = await prisma.promptImage.findUnique({ where: { promptId: id } })
  if (row?.type === 'tg') {
    const url = await tgFileUrl(row.data)
    if (url) return NextResponse.redirect(url, { headers: { 'Cache-Control': 'public, max-age=86400' } })
  } else if (row?.data) {
    return new Response(Buffer.from(row.data, 'base64'), {
      headers: { 'Content-Type': row.type ?? 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
    })
  }

  const up = await prisma.uploadImage.findUnique({ where: { id } })
  if (up) {
    const url = await tgFileUrl(up.fileId)
    if (url) return NextResponse.redirect(url, { headers: { 'Cache-Control': 'public, max-age=86400' } })
  }

  const p = await prisma.prompt.findUnique({ where: { id }, select: { imgData: true, imgType: true } })
  if (p?.imgData) {
    return new Response(Buffer.from(p.imgData, 'base64'), {
      headers: { 'Content-Type': p.imgType ?? 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
    })
  }

  return NextResponse.json({ error: 'not found' }, { status: 404 })
}
EOF

# ---------- 5) set-storage debug ----------
cat > src/app/api/debug/set-storage/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })

  const source = (await prisma.setting.findUnique({ where: { key: 'tg_chat_id' } }))?.value ?? ''
  const ur = await (await fetch('https://api.telegram.org/bot' + token + '/getUpdates?limit=100', { signal: AbortSignal.timeout(10000) })).json()

  for (const u of ur.result ?? []) {
    const chat = u.channel_post?.chat
    if (chat && chat.type === 'channel' && String(chat.id) !== source) {
      await prisma.setting.upsert({
        where: { key: 'tg_storage_chat' },
        update: { value: String(chat.id) },
        create: { key: 'tg_storage_chat', value: String(chat.id) },
      })
      return NextResponse.json({ ok: true, storage: String(chat.id), title: chat.title })
    }
  }
  return NextResponse.json({ ok: false, hint: 'یک پیام در کانال انبار بفرست (بات ادمین باشد) و دوباره بزن' })
}
EOF

# ---------- 6) upload api (<=1MB -> telegram storage) ----------
cat > src/app/api/upload/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export const maxDuration = 30

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'login required' }, { status: 401 })

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const storage = (await prisma.setting.findUnique({ where: { key: 'tg_storage_chat' } }))?.value ?? (await prisma.setting.findUnique({ where: { key: 'tg_private_chat' } }))?.value
  if (!token || !storage) return NextResponse.json({ error: 'storage not configured' }, { status: 500 })

  const { dataUrl } = await req.json()
  const m = String(dataUrl ?? '').match(/^data:(image\/[a-z+]+);base64,(.+)$/)
  if (!m) return NextResponse.json({ error: 'bad image' }, { status: 400 })

  const buf = Buffer.from(m[2], 'base64')
  if (buf.length > 1_000_000) return NextResponse.json({ error: 'حجم تصویر باید کمتر از ۱ مگابایت باشد', tooBig: true }, { status: 400 })

  const form = new FormData()
  form.append('chat_id', storage)
  form.append('photo', new Blob([new Uint8Array(buf)], { type: m[1] }), 'upload.jpg')
  const r = await fetch('https://api.telegram.org/bot' + token + '/sendPhoto', { method: 'POST', body: form, signal: AbortSignal.timeout(20000) })
  const j = await r.json()
  const photos = j?.result?.photo
  if (!j.ok || !photos?.length) return NextResponse.json({ error: 'telegram upload failed: ' + (j.description ?? '') }, { status: 500 })

  const fileId = photos[photos.length - 1].file_id
  const up = await prisma.uploadImage.create({ data: { fileId } })

  return NextResponse.json({ ok: true, id: up.id, url: (process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir') + '/api/img/' + up.id })
}
EOF

# ---------- 7) upload input component ----------
cat > src/components/upload-input.tsx << 'EOF'
'use client'

import { useRef, useState } from 'react'

export default function UploadInput({ label, tooBigMsg }: { label: string; tooBigMsg: string }) {
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setErr('')
    if (f.size > 1_000_000) { setErr(tooBigMsg); return }
    setBusy(true)
    const reader = new FileReader()
    reader.onload = async () => {
      setPreview(String(reader.result))
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: reader.result }),
        })
        const j = await res.json()
        if (!res.ok) { setErr(j.tooBig ? tooBigMsg : (j.error ?? 'خطا')); setPreview(''); }
        else setUrl(j.url)
      } catch {
        setErr('خطا در آپلود')
        setPreview('')
      }
      setBusy(false)
    }
    reader.readAsDataURL(f)
  }

  return (
    <div>
      <input type="hidden" name="img" value={url} required />
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-gold/40 bg-elevated/50 px-5 py-6 text-sm text-ink-muted transition-colors hover:border-gold"
      >
        {preview ? (
          <img src={preview} alt="" className="h-16 w-16 rounded-xl object-cover" />
        ) : (
          <span className="text-2xl">🖼</span>
        )}
        <span>{busy ? 'در حال آپلود...' : preview ? 'تغییر تصویر ✅' : label}</span>
      </button>
      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
    </div>
  )
}
EOF

# ---------- 8) submit page with upload ----------
cat > src/app/submit/page.tsx << 'EOF'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { getCategories, L } from '@/lib/data'
import { type Locale } from '@/lib/i18n'
import UploadInput from '@/components/upload-input'

export const metadata = { title: 'ارسال پرامپت | PromptsFA' }
export const dynamic = 'force-dynamic'

export default async function SubmitPage() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const session = await auth()
  const categories = await getCategories()

  if (!session?.user) {
    return (
      <section className="container-app grid min-h-[60vh] place-items-center py-16">
        <div className="card max-w-md p-8 text-center">
          <p className="text-sm text-ink-muted">{L(locale, 'برای ارسال پرامپت ابتدا وارد شو.', 'Please login to submit.')}</p>
          <a href="/login" className="btn-primary mt-5 inline-flex">{L(locale, 'ورود', 'Login')}</a>
        </div>
      </section>
    )
  }

  async function submit(fd: FormData) {
    'use server'
    const s = await auth()
    if (!s?.user?.id) return redirect('/login')
    const img = String(fd.get('img') ?? '')
    const title = String(fd.get('title') ?? '').trim()
    const prompt = String(fd.get('prompt') ?? '').trim()
    if (!img || !title || !prompt) return
    const catId = String(fd.get('category') ?? '')
    await prisma.prompt.create({
      data: {
        titleFa: title,
        titleEn: title,
        descFa: String(fd.get('desc') ?? '').trim(),
        descEn: String(fd.get('desc') ?? '').trim(),
        usageFa: '',
        usageEn: '',
        slug: 'u-' + Date.now(),
        img,
        model: 'AI',
        type: 'IMAGE',
        status: 'PENDING',
        categoryId: catId || (await prisma.category.findFirst())!.id,
        tagsFa: [],
        tagsEn: [],
        prompt,
        userId: s.user.id,
      },
    })
    redirect('/?sent=1')
  }

  return (
    <section className="container-app max-w-2xl py-16">
      <h1 className="font-display text-2xl font-extrabold">{L(locale, 'ارسال پرامپت', 'Submit prompt')}</h1>
      <p className="mt-2 text-xs text-ink-muted">{L(locale, 'پرامپت تو پس از تأیید ادمین منتشر می‌شود.', 'Your prompt will be published after admin approval.')}</p>

      <form action={submit} className="card mt-8 space-y-5 p-6">
        <UploadInput label={L(locale, 'آپلود تصویر (حداکثر ۱ مگابایت)', 'Upload image (max 1MB)')} tooBigMsg={L(locale, 'حجم تصویر باید کمتر از ۱ مگابایت باشد', 'Image must be under 1MB')} />

        <input name="title" required placeholder={L(locale, 'عنوان', 'Title')} className="input" />
        <textarea name="prompt" required rows={5} placeholder={L(locale, 'متن پرامپت', 'Prompt text')} className="input resize-none" />
        <textarea name="desc" rows={2} placeholder={L(locale, 'توضیح کوتاه (اختیاری)', 'Short description (optional)')} className="input resize-none" />

        <select name="category" className="input">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{L(locale, c.nameFa, c.nameEn)}</option>
          ))}
        </select>

        <button type="submit" className="btn-primary w-full justify-center">{L(locale, 'ارسال برای بررسی', 'Submit for review')}</button>
      </form>
    </section>
  )
}
EOF

# ---------- 9) cron: store file_id instead of base64 ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/telegram/route.ts'
let s = fs.readFileSync(p, 'utf8')

// use file_id directly, no base64 download
const old = `    // download full image via Bot API
    let imgBase64: string | null = null
    let imgType = 'image/jpeg'
    try {
      const fr = await (await fetch(api('getFile', { file_id: m.fileId }), { signal: AbortSignal.timeout(10000) })).json()
      const path = fr.result?.file_path
      if (path) {
        const fileUrl = 'https://api.telegram.org/file/bot' + token + '/' + path
        const ir = await fetch(fileUrl, { signal: AbortSignal.timeout(20000) })
        const buf = Buffer.from(await ir.arrayBuffer())
        if (ir.ok && buf.length > 5000 && buf.length < 2_500_000) {
          imgBase64 = buf.toString('base64')
          imgType = path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
        }
      }
    } catch {}

    if (!imgBase64) { results.push({ id: m.id, skipped: 'image download failed' }); continue }`

const nw = `    // keep only file_id (image lives on Telegram forever)
    const fileId = m.fileId
    if (!fileId) { results.push({ id: m.id, skipped: 'no file id' }); continue }`

if (s.includes(old)) {
  s = s.replace(old, nw)
  s = s.replace(/imgData: imgBase64, imgType,\n/g, '')
  s = s.replace(
    "await prisma.promptImage.create({ data: { promptId: prompt.id, data: imgBase64, type: imgType } }).catch(() => {})",
    "await prisma.promptImage.create({ data: { promptId: prompt.id, data: fileId, type: 'tg' } }).catch(() => {})"
  )
  s = s.replace('let ai\n      try {\n        ai = await analyzeWithGemini({ text: m.text, imgBase64, imgMime: imgType, categories })', 'let ai\n      try {\n        ai = await analyzeWithGemini({ text: m.text, imgBase64: null, categories })')
  s = s.replace('ai = await analyzeWithGemini({ text: m.text, imgBase64: null, categories })\n      }', 'ai = await analyzeWithGemini({ text: m.text, imgBase64: null, categories })\n      }')
  fs.writeFileSync(p, s)
  console.log('✅ cron: file_id storage')
} else console.log('❌ cron pattern not found')
NODEEOF

# ---------- 10) migrate base64 -> telegram ----------
cat > src/app/api/debug/migrate-img/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const storage = (await prisma.setting.findUnique({ where: { key: 'tg_storage_chat' } }))?.value ?? (await prisma.setting.findUnique({ where: { key: 'tg_private_chat' } }))?.value
  if (!token || !storage) return NextResponse.json({ error: 'storage not set — run /api/debug/set-storage first' }, { status: 500 })

  const rows = await prisma.promptImage.findMany({ where: { OR: [{ type: null }, { type: 'image/jpeg' }, { type: 'image/png' }, { type: 'image/webp' }] }, take: 10 })

  let moved = 0
  const errors: string[] = []
  for (const r of rows) {
    if (r.data.length < 500) continue
    try {
      const buf = Buffer.from(r.data, 'base64')
      const form = new FormData()
      form.append('chat_id', storage)
      form.append('photo', new Blob([new Uint8Array(buf)], { type: r.type ?? 'image/jpeg' }), 'img.jpg')
      const res = await fetch('https://api.telegram.org/bot' + token + '/sendPhoto', { method: 'POST', body: form, signal: AbortSignal.timeout(25000) })
      const j = await res.json()
      const fileId = j?.result?.photo?.[j.result.photo.length - 1]?.file_id
      if (!fileId) { errors.push(r.promptId + ': ' + (j.description ?? 'no file')); continue }
      await prisma.promptImage.update({ where: { promptId: r.promptId }, data: { data: fileId, type: 'tg' } })
      moved++
    } catch (e: any) {
      errors.push(r.promptId + ': ' + String(e?.message ?? e))
    }
  }

  const left = await prisma.promptImage.count({ where: { OR: [{ type: null }, { type: 'image/jpeg' }, { type: 'image/png' }, { type: 'image/webp' }] } })
  return NextResponse.json({ ok: true, moved, left, errors })
}
EOF

echo "✅ update74 done!"