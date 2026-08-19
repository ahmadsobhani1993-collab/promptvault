#!/bin/bash
set -e

# ---------- 1) Clean rewrite of article-form.tsx ----------
cat > src/components/article-form.tsx << 'EOF'
'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import RichTextEditor from '@/components/rich-text-editor'

export default function ArticleForm({ initialData }: { initialData?: any }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const isEdit = !!initialData?.id

  useEffect(() => {
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMsg('')
    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/upload-to-telegram', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.ok) {
        const imgInput = document.querySelector('input[name="img"]') as HTMLInputElement
        if (imgInput) {
          imgInput.value = data.fileUrl
        }
        setMsg('✅ عکس با موفقیت آپلود شد')
      } else {
        setMsg('❌ خطا در آپلود: ' + (data.error || 'نامشخص'))
      }
    } catch (err: any) {
      setMsg('❌ خطا در ارتباط با سرور')
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')

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
        setMsg('❌ ' + (j.error || 'خطا'))
        setBusy(false)
      }
    } catch (err) {
      setMsg('❌ خطا در ارتباط با سرور')
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
          <label className="mb-1 block text-xs text-ink-muted">آدرس تصویر کاور</label>
          <input name="img" defaultValue={initialData?.img || ''} className="input text-sm" dir="ltr" placeholder="https://..." />
          <div className="mt-2">
            <label className="block text-xs text-ink-muted mb-1">یا آپلود مستقیم (به تلگرام):</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploading}
              className="input text-xs py-1.5"
            />
            {uploading && <p className="mt-1 text-xs text-gold-bright">⏳ در حال آپلود به تلگرام...</p>}
          </div>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-muted">متن مقاله (فرمت سئو حفظ می‌شود)</label>
        <RichTextEditor name="contentFa" initialValue={Array.isArray(initialData?.contentFa) ? initialData.contentFa.join('\n') : (initialData?.contentFa || '')} />
      </div>
      {msg && (
        <p className={`text-xs ${msg.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>
      )}
      <button disabled={busy} className="btn-primary w-full justify-center">
        {busy ? ' در حال ذخیره...' : (isEdit ? '💾 ذخیره تغییرات' : ' انتشار مقاله')}
      </button>
    </form>
  )
}
EOF
echo "✅ Article form: clean rewrite with upload button"

echo "✅ update191 done!"