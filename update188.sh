#!/bin/bash
set -e

# ---------- 1) Update Article Form to support Edit Mode ----------
cat > src/components/article-form.tsx << 'EOF'
'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import RichTextEditor from '@/components/rich-text-editor'

export default function ArticleForm({ initialData }: { initialData?: any }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const isEdit = !!initialData?.id

  useEffect(() => {
    // Pre-fill rich text editor if editing
    if (isEdit && initialData?.contentFa && formRef.current) {
      const editor = formRef.current.querySelector('[contenteditable]') as HTMLDivElement
      const textarea = formRef.current.querySelector('textarea[name="contentFa"]') as HTMLTextAreaElement
      if (editor && textarea) {
        const htmlContent = Array.isArray(initialData.contentFa) ? initialData.contentFa.join('\n') : initialData.contentFa
        editor.innerHTML = htmlContent
        textarea.value = htmlContent
      }
    }
  }, [isEdit, initialData])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    
    const editor = formRef.current?.querySelector('[contenteditable]') as HTMLDivElement
    const textarea = formRef.current?.querySelector('textarea[name="contentFa"]') as HTMLTextAreaElement
    if (editor && textarea) {
      textarea.value = editor.innerHTML
    }
    
    const fd = new FormData(e.currentTarget)
    const actionType = isEdit ? 'update' : 'create'
    const payload: any = {
      action: actionType,
      titleFa: fd.get('titleFa'),
      descFa: fd.get('descFa'),
      contentFa: fd.get('contentFa'),
      img: fd.get('img'),
      tagFa: fd.get('tagFa'),
    }
    if (isEdit) payload.id = initialData.id

    try {
      const res = await fetch('/api/admin/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (j.ok) {
        router.push('/admin/articles')
      } else {
        setMsg(j.error ?? 'خطا')
        setBusy(false)
      }
    } catch (err) {
      setMsg('خطا در ارتباط با سرور')
      setBusy(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <label className="mb-1 block text-xs text-ink-muted">عنوان *</label>
        <input name="titleFa" required defaultValue={initialData?.titleFa || ''} className="input text-sm" placeholder="عنوان مقاله" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-muted">توضیح متا (سئو)</label>
        <input name="descFa" defaultValue={initialData?.descFa || ''} className="input text-sm" placeholder="۱۵۵ کاراکتر..." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-ink-muted">کلمه کلیدی</label>
          <input name="tagFa" defaultValue={initialData?.tagFa || ''} className="input text-sm" placeholder="مثلاً: پرامپت نویسی" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">آدرس تصویر کاور (قابل ویرایش)</label>
          <input name="img" defaultValue={initialData?.img || ''} className="input text-sm" dir="ltr" placeholder="https://..." />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-muted">متن مقاله (فرمت سئو حفظ می‌شود)</label>
        <RichTextEditor name="contentFa" initialValue={Array.isArray(initialData?.contentFa) ? initialData.contentFa.join('\n') : (initialData?.contentFa || '')} />
      </div>
      {msg && <p className="text-xs text-red-400">{msg}</p>}
      <button disabled={busy} className="btn-primary w-full justify-center">
        {busy ? 'در حال ذخیره...' : (isEdit ? '💾 ذخیره تغییرات' : '📤 انتشار مقاله')}
      </button>
    </form>
  )
}
EOF
echo "✅ Article form: supports edit mode + editable image"

# ---------- 2) Create Edit Page ----------
mkdir -p src/app/admin/articles/[id]/edit
cat > src/app/admin/articles/[id]/edit/page.tsx << 'EOF'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import ArticleForm from '@/components/article-form'

export const dynamic = 'force-dynamic'

export default async function EditArticle({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  const { id } = await params
  const article = await prisma.article.findUnique({ where: { id } })
  if (!article) notFound()

  return (
    <section className="container-app py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold">✍️ ویرایش مقاله</h1>
          <p className="mt-1 text-xs text-ink-muted">عنوان: {article.titleFa}</p>
        </div>
        <Link href="/admin/articles" className="btn-secondary text-xs">← لیست مقالات</Link>
      </div>
      <div className="max-w-3xl">
        <ArticleForm initialData={article} />
      </div>
    </section>
  )
}
EOF
echo "✅ Edit article page created"

# ---------- 3) Add Update action to Admin API ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/admin/articles/route.ts'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes("action === 'update'")) {
  const updateBlock = `  if (action === 'update') {
    const titleFa = String(j.titleFa ?? '').trim()
    if (!titleFa) return NextResponse.json({ error: 'title required' }, { status: 400 })
    
    const contentRaw = String(j.contentFa ?? '')
    const img = String(j.img ?? '').trim() || article.img
    
    await prisma.article.update({
      where: { id },
      data: {
        titleFa,
        titleEn: titleFa,
        descFa: String(j.descFa ?? titleFa).trim(),
        descEn: String(j.descFa ?? titleFa).trim(),
        img,
        tagFa: String(j.tagFa ?? 'هوش مصنوعی').trim(),
        tagEn: String(j.tagFa ?? 'هوش مصنوعی').trim(),
        contentFa: contentRaw.split(/\\n|<br\\s*\\/?>/i).map((x: string) => x.trim()).filter(Boolean),
        contentEn: contentRaw.split(/\\n|<br\\s*\\/?>/i).map((x: string) => x.trim()).filter(Boolean),
      },
    })
    return NextResponse.json({ ok: true })
  }
`
  // Insert before 'delete'
  s = s.replace("if (action === 'delete')", updateBlock + "\n  if (action === 'delete')")
  
  // Fix variable name for j
  if (!s.includes('const j = await req.json()')) {
     s = s.replace('const { id, action } = await req.json()', 'const j = await req.json()\n  const { id, action } = j')
  }
  
  fs.writeFileSync(p, s)
  console.log('✅ Admin API: update action added')
} else {
  console.log('⚠️ Update action already exists')
}
NODEEOF

# ---------- 4) Add Edit button to Articles List ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/admin/articles/page.tsx'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('/admin/articles/' + a.id + '/edit')) {
  // Add edit button next to actions
  s = s.replace(
    /<ArticleActions id=\{a\.id\} status=\{a\.status\} \/>/,
    `<div className="flex items-center gap-2">
        <Link href={'/admin/articles/' + a.id + '/edit'} className="rounded-full bg-blue-500/15 px-3 py-1 text-[10px] text-blue-400 transition-colors hover:bg-blue-500/25">✏️ ویرایش</Link>
        <ArticleActions id={a.id} status={a.status} />
      </div>`
  )
  fs.writeFileSync(p, s)
  console.log('✅ Articles list: Edit button added')
} else {
  console.log('⚠️ Edit button already exists')
}
NODEEOF

# ---------- 5) Force AI to output SEO-friendly HTML ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/article/route.ts'
let s = fs.readFileSync(p, 'utf8')

// Update the instruction to demand HTML output for contentFa
const oldContentReq = '"contentFa"'
const newContentReq = '"contentFa" (MUST be valid HTML string with <h2>, <p>, <strong>, <ul>, <li> tags for SEO)'

if (s.includes(oldContentReq) && !s.includes('MUST be valid HTML')) {
  s = s.replace(oldContentReq, newContentReq)
  fs.writeFileSync(p, s)
  console.log('✅ AI Prompt: forced to generate HTML for SEO structure')
} else {
  console.log('⚠️ AI prompt already updated or not found')
}
NODEEOF

echo "✅ update188 done!"