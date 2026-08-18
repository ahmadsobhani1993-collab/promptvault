#!/bin/bash
set -e

# ---------- 1) admin LAYOUT nav: add analytics ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/admin/layout.tsx'
if (fs.existsSync(p)) {
  let s = fs.readFileSync(p, 'utf8')
  if (!s.includes('/admin/analytics')) {
    if (s.includes('/admin/prompts')) {
      s = s.replace(/\{\s*href:\s*['"]\/admin\/prompts['"]/, "{ href: '/admin/analytics', label: 'آمار بازدید' },\n    { href: '/admin/prompts'")
      fs.writeFileSync(p, s)
      console.log('✅ layout nav: analytics added')
    } else {
      console.log('⚠️ layout has no prompts link; printing head:')
      console.log(s.slice(0, 1500))
    }
  } else console.log('⚠️ already in layout')
} else console.log('⚠️ no admin layout file')
NODEEOF

# ---------- 2) article route: force param ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/article/route.ts'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('force')) {
  s = s.replace(
    "const step = searchParams.get('step') ?? '1'",
    "const step = searchParams.get('step') ?? '1'\n  const force = searchParams.get('force') === '1'"
  )
  s = s.replace(
    "if (todayCount > 0) return NextResponse.json({ ok: true, skipped: 'article exists today', schedule })",
    "if (!force && todayCount > 0) return NextResponse.json({ ok: true, skipped: 'article exists today', schedule })"
  )
  fs.writeFileSync(p, s)
  console.log('✅ article: force param')
} else console.log('⚠️ already')
NODEEOF

# ---------- 3) admin API: create article manually ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/admin/articles/route.ts'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes("action === 'create'")) {
  const block = `  if (action === 'create') {
    const now = new Date()
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now)
    const dateFa = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'long', day: 'numeric' }).format(now)
    const dateEn = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'long', day: 'numeric' }).format(now)
    const titleFa = String(j.titleFa ?? '').trim()
    if (!titleFa) return NextResponse.json({ error: 'title required' }, { status: 400 })
    const descFa = String(j.descFa ?? titleFa).trim()
    const contentRaw = String(j.contentFa ?? '')
    const tagFa = String(j.tagFa ?? 'هوش مصنوعی').trim()
    const img = String(j.img ?? '').trim() || 'https://image.pollinations.ai/prompt/' + encodeURIComponent(titleFa) + '?width=1200&height=630&nologo=true'
    const a = await prisma.article.create({
      data: {
        slug: 'manual-' + now.getTime().toString(36),
        titleFa,
        titleEn: titleFa,
        descFa,
        descEn: descFa,
        img,
        tagFa,
        tagEn: tagFa,
        dateFa,
        dateEn,
        readFa: '۵ دقیقه مطالعه',
        readEn: '5 min read',
        contentFa: contentRaw.split(/\\n/).map((x: string) => x.trim()).filter(Boolean),
        contentEn: contentRaw.split(/\\n/).map((x: string) => x.trim()).filter(Boolean),
        status: 'PUBLISHED',
      },
    })
    return NextResponse.json({ ok: true, slug: a.slug })
  }
`
  s = s.replace("if (action === 'delete')", block + "\n  if (action === 'delete')")
  // body var name
  if (!s.includes('const j = await req.json()') && !s.includes('const { id, action } = await req.json()')) {}
  s = s.replace('const { id, action } = await req.json()', 'const j = await req.json()\n  const { id, action } = j')
  fs.writeFileSync(p, s)
  console.log('✅ admin API: create article')
} else console.log('⚠️ already')
NODEEOF

# ---------- 4) article form component + new page ----------
cat > src/components/article-form.tsx << 'EOF'
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ArticleForm() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const submit = async (e: any) => {
    e.preventDefault()
    setBusy(true)
    const fd = new FormData(e.target)
    const res = await fetch('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        titleFa: fd.get('titleFa'),
        descFa: fd.get('descFa'),
        contentFa: fd.get('contentFa'),
        img: fd.get('img'),
        tagFa: fd.get('tagFa'),
      }),
    })
    const j = await res.json()
    if (j.ok) router.push('/admin/articles')
    else {
      setMsg(j.error ?? 'خطا')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <label className="mb-1 block text-xs text-ink-muted">عنوان *</label>
        <input name="titleFa" required className="input text-sm" placeholder="عنوان مقاله" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-muted">توضیح متا (سئو)</label>
        <input name="descFa" className="input text-sm" placeholder="۱۵۵ کاراکتر..." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-ink-muted">کلمه کلیدی</label>
          <input name="tagFa" className="input text-sm" placeholder="مثلاً: پرامپت نویسی" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">آدرس تصویر کاور (اختیاری)</label>
          <input name="img" className="input text-sm" dir="ltr" placeholder="https://..." />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-muted">متن مقاله (هر خط = یک پاراگراف؛ ## برای زیرعنوان)</label>
        <textarea name="contentFa" required rows={14} className="input w-full text-sm leading-7" placeholder={'## مقدمه\nمتن...'} />
      </div>
      {msg && <p className="text-xs text-red-400">{msg}</p>}
      <button disabled={busy} className="btn-primary w-full justify-center">{busy ? 'در حال انتشار...' : ' انتشار مقاله'}</button>
    </form>
  )
}
EOF

cat > src/app/admin/articles/new/page.tsx << 'EOF'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import ArticleForm from '@/components/article-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'مقاله جدید | مدیریت' }

export default async function NewArticle() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  return (
    <section className="container-app py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">✍️ مقاله دستی جدید</h1>
        <Link href="/admin/articles" className="btn-secondary text-xs">← لیست مقالات</Link>
      </div>
      <div className="mt-6 max-w-3xl">
        <ArticleForm />
      </div>
    </section>
  )
}
EOF
echo "✅ manual article form"

# ---------- 5) add "new article" button to articles list ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/admin/articles/page.tsx'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('/admin/articles/new')) {
  s = s.replace(
    "<Link href=\"/admin\" className=\"btn-secondary text-xs\">← داشبورد</Link>",
    "<div className=\"flex gap-2\"><Link href=\"/admin/articles/new\" className=\"btn-primary text-xs\">+ مقاله دستی</Link><Link href=\"/admin\" className=\"btn-secondary text-xs\">← داشبورد</Link></div>"
  )
  fs.writeFileSync(p, s)
  console.log('✅ articles list: new-article button')
} else console.log('⚠️ already')
NODEEOF

echo "✅ update118 done!"