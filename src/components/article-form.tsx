'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import RichTextEditor from '@/components/rich-text-editor'

export default function ArticleForm({ initialData }: { initialData?: any }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const [imgUrl, setImgUrl] = useState(initialData?.img || '')

  const initialContent = Array.isArray(initialData?.contentFa)
    ? initialData.contentFa.join('\n')
    : initialData?.contentFa || ''

  const [contentFa, setContentFa] = useState(initialContent)

  const isEdit = !!initialData?.id

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
        setImgUrl(data.fileUrl)
        setMsg('✅ عکس با موفقیت آپلود شد')
      } else {
        setMsg('❌ خطا در آپلود: ' + (data.error || 'نامشخص'))
      }
    } catch (err) {
      setMsg('❌ خطا در ارتباط با سرور')
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')

    const fd = new FormData(e.currentTarget)
    const actionType = isEdit ? 'update' : 'create'
    const payload: any = {
      action: actionType,
      titleFa: fd.get('titleFa'),
      descFa: fd.get('descFa'),
      contentFa: contentFa,
      img: imgUrl,
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
    <form onSubmit={submit} className="card space-y-4 p-6 bg-surface border border-line rounded-2xl">
      <div>
        <label className="mb-1 block text-xs text-ink-muted">عنوان *</label>
        <input name="titleFa" required defaultValue={initialData?.titleFa || ''} className="input text-sm w-full bg-elevated border-line text-ink rounded-xl p-2.5 focus:border-gold outline-none" placeholder="عنوان مقاله" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-muted">توضیح متا (سئو)</label>
        <input name="descFa" defaultValue={initialData?.descFa || ''} className="input text-sm w-full bg-elevated border-line text-ink rounded-xl p-2.5 focus:border-gold outline-none" placeholder="۱۵۵ کاراکتر..." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-ink-muted">کلمه کلیدی</label>
          <input name="tagFa" defaultValue={initialData?.tagFa || ''} className="input text-sm w-full bg-elevated border-line text-ink rounded-xl p-2.5 focus:border-gold outline-none" placeholder="مثلاً: پرامپت نویسی" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">آدرس تصویر کاور</label>
          <input name="img" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} className="input text-sm w-full bg-elevated border-line text-ink rounded-xl p-2.5 focus:border-gold outline-none" dir="ltr" placeholder="https://..." />
          <div className="mt-2">
            <label className="block text-xs text-ink-muted mb-1">یا آپلود مستقیم (به تلگرام):</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploading}
              className="input text-xs py-1.5 w-full bg-elevated border-line rounded-xl"
            />
            {uploading && <p className="mt-1 text-xs text-gold-bright">⏳ در حال آپلود به تلگرام...</p>}
          </div>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-muted">متن مقاله (فرمت سئو حفظ می‌شود)</label>
        <RichTextEditor value={contentFa} onChange={setContentFa} />
      </div>
      {msg && (
        <p className={`text-xs ${msg.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>
      )}
      <button disabled={busy} type="submit" className="btn-primary w-full justify-center bg-gold hover:bg-gold-bright text-ink-inverse font-semibold py-3 rounded-xl transition shadow-gold-glow">
        {busy ? 'در حال ذخیره...' : (isEdit ? '💾 ذخیره تغییرات' : '🚀 انتشار مقاله')}
      </button>
    </form>
  )
}