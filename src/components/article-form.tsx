'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import RichTextEditor from '@/components/rich-text-editor'

interface ArticleFormData {
  id?: string
  titleFa?: string
  titleEn?: string
  descFa?: string
  descEn?: string
  tagFa?: string
  tagEn?: string
  img?: string
  contentFa?: string | string[]
  contentEn?: string | string[]
}

function contentValue(content: string | string[] | undefined): string {
  return Array.isArray(content) ? content.join('\n\n') : content ?? ''
}

export default function ArticleForm({ initialData }: { initialData?: ArticleFormData }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const [imgUrl, setImgUrl] = useState(initialData?.img || '')
  const [contentFa, setContentFa] = useState(contentValue(initialData?.contentFa))
  const [contentEn, setContentEn] = useState(contentValue(initialData?.contentEn))
  const [activeLanguage, setActiveLanguage] = useState<'fa' | 'en'>('fa')
  const isEdit = Boolean(initialData?.id)

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMsg('')
    const formData = new FormData()
    formData.append('image', file)

    try {
      const response = await fetch('/api/upload-to-telegram', { method: 'POST', body: formData })
      const data = await response.json()
      if (!response.ok || !data.ok || typeof data.fileUrl !== 'string') {
        setMsg('❌ خطا در آپلود تصویر')
        return
      }
      setImgUrl(data.fileUrl)
      setMsg('✅ عکس با موفقیت آپلود شد')
    } catch {
      setMsg('❌ خطا در ارتباط با سرور')
    } finally {
      setUploading(false)
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setMsg('')

    const formData = new FormData(event.currentTarget)
    const payload = {
      action: isEdit ? 'update' : 'create',
      id: initialData?.id,
      titleFa: formData.get('titleFa'),
      titleEn: formData.get('titleEn'),
      descFa: formData.get('descFa'),
      descEn: formData.get('descEn'),
      tagFa: formData.get('tagFa'),
      tagEn: formData.get('tagEn'),
      img: imgUrl,
      contentFa,
      contentEn,
    }

    try {
      const response = await fetch('/api/admin/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) {
        setMsg(`❌ ${result.error || 'ذخیره مقاله انجام نشد'}`)
        return
      }
      router.push('/admin/articles')
      router.refresh()
    } catch {
      setMsg('❌ خطا در ارتباط با سرور')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="card space-y-4 rounded-2xl p-5 md:p-6">
        <div>
          <h2 className="text-sm font-bold text-gold-bright">اطلاعات مقاله</h2>
          <p className="mt-1 text-xs text-ink-muted">عنوان و توضیحات هر دو زبان را جداگانه وارد کنید.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-xs text-ink-muted">
            عنوان فارسی *
            <input name="titleFa" required defaultValue={initialData?.titleFa || ''} className="input mt-1.5" placeholder="عنوان مقاله" />
          </label>
          <label className="block text-xs text-ink-muted" dir="ltr">
            English title *
            <input name="titleEn" required defaultValue={initialData?.titleEn || ''} className="input mt-1.5 text-left" placeholder="Article title" />
          </label>
          <label className="block text-xs text-ink-muted">
            توضیح کوتاه فارسی *
            <textarea name="descFa" required defaultValue={initialData?.descFa || ''} rows={3} className="input mt-1.5 resize-y" placeholder="خلاصه‌ای برای کارت و توضیحات گوگل" />
          </label>
          <label className="block text-xs text-ink-muted" dir="ltr">
            English summary *
            <textarea name="descEn" required defaultValue={initialData?.descEn || ''} rows={3} className="input mt-1.5 resize-y text-left" placeholder="A short summary for cards and search results" />
          </label>
          <label className="block text-xs text-ink-muted">
            دسته‌بندی فارسی *
            <input name="tagFa" required defaultValue={initialData?.tagFa || ''} className="input mt-1.5" placeholder="مثلاً: هوش مصنوعی" />
          </label>
          <label className="block text-xs text-ink-muted" dir="ltr">
            English category *
            <input name="tagEn" required defaultValue={initialData?.tagEn || ''} className="input mt-1.5 text-left" placeholder="For example: AI" />
          </label>
        </div>
      </section>

      <section className="card space-y-4 rounded-2xl p-5 md:p-6">
        <div>
          <h2 className="text-sm font-bold text-gold-bright">تصویر شاخص</h2>
          <p className="mt-1 text-xs text-ink-muted">از تصویری استفاده کنید که مجوز انتشار آن را دارید.</p>
        </div>
        <label className="block text-xs text-ink-muted">
          آدرس تصویر
          <input value={imgUrl} onChange={(event) => setImgUrl(event.target.value)} className="input mt-1.5 text-left" dir="ltr" placeholder="https://..." />
        </label>
        <label className="block text-xs text-ink-muted">
          یا آپلود مستقیم
          <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="input mt-1.5 py-2" />
        </label>
        {uploading && <p className="text-xs text-gold-bright">⏳ در حال آپلود تصویر...</p>}
        {imgUrl && <img src={imgUrl} alt="پیش‌نمایش تصویر شاخص" className="aspect-[16/7] w-full rounded-xl border border-line object-cover" />}
      </section>

      <section className="card space-y-4 rounded-2xl p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-gold-bright">متن مقاله</h2>
            <p className="mt-1 text-xs text-ink-muted">از تیترها و فهرست‌ها استفاده کنید تا مقاله خواناتر باشد.</p>
          </div>
          <div className="flex rounded-xl border border-line bg-elevated p-1">
            <button type="button" onClick={() => setActiveLanguage('fa')} className={`rounded-lg px-3 py-1.5 text-xs ${activeLanguage === 'fa' ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted'}`}>فارسی</button>
            <button type="button" onClick={() => setActiveLanguage('en')} className={`rounded-lg px-3 py-1.5 text-xs ${activeLanguage === 'en' ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted'}`}>English</button>
          </div>
        </div>
        {activeLanguage === 'fa' ? (
          <div dir="rtl">
            <RichTextEditor value={contentFa} onChange={setContentFa} direction="rtl" />
          </div>
        ) : (
          <div dir="ltr">
            <RichTextEditor value={contentEn} onChange={setContentEn} direction="ltr" />
          </div>
        )}
      </section>

      {msg && <p role="status" className={`text-xs ${msg.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}
      <button disabled={busy || uploading} type="submit" className="btn-primary w-full justify-center py-3 font-semibold disabled:opacity-50">
        {busy ? 'در حال ذخیره...' : (isEdit ? '💾 ذخیره تغییرات' : '🚀 انتشار مقاله')}
      </button>
    </form>
  )
}
