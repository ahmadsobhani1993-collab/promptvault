'use client'

import { useState, useRef } from 'react'
import { L } from '@/lib/data'
import { type Locale } from '@/lib/i18n'
import { submitPromptAction } from '@/app/submit/actions'

type Category = {
  id: string
  nameFa: string
  nameEn: string
}

type Props = {
  categories: Category[]
  locale: Locale
}

export default function SubmitForm({ categories, locale }: Props) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [imageUrl, setImageUrl] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // ✅ تغییر محدودیت از 1MB به 3MB
    if (file.size > 3 * 1024 * 1024) {
      setError(
        locale === 'fa'
          ? 'حجم تصویر باید کمتر از ۳ مگابایت باشد'
          : 'Image must be under 3MB'
      )
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setError('')
    setUploading(true)
    setProgress(0)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/upload', true)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100)
          setProgress(percentComplete)
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText)
            if (res.url) {
              setImageUrl(res.url)
            } else {
              setError(locale === 'fa' ? 'خطا در آپلود تصویر' : 'Upload failed')
            }
          } catch (err) {
            setError(locale === 'fa' ? 'خطا در پردازش پاسخ سرور' : 'Error parsing server response')
          }
        } else {
          setError(locale === 'fa' ? 'خطا در آپلود تصویر' : 'Upload failed')
        }
        setUploading(false)
      }

      xhr.onerror = () => {
        setError(locale === 'fa' ? 'خطا در اتصال به سرور' : 'Connection error')
        setUploading(false)
      }

      xhr.send(formData)
    } catch (err) {
      setError(locale === 'fa' ? 'خطا در آپلود' : 'Upload error')
      setUploading(false)
    }
  }

  return (
    <form action={submitPromptAction} className="card mt-8 space-y-5 p-6">
      <div>
        <label className="block text-sm font-medium mb-2">
          {/* ✅ تغییر متن لیبل به ۳ مگابایت */}
          {L(locale, 'آپلود تصویر (حداکثر ۳ مگابایت)', 'Upload image (max 3MB)')}
        </label>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileChange}
          className="file:btn-secondary file:ml-4 file:cursor-pointer block w-full text-sm text-ink-muted border border-line rounded-lg bg-elevated p-2"
          required={!imageUrl}
        />
        
        {uploading && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-ink-muted mb-1">
              <span>{locale === 'fa' ? 'در حال آپلود...' : 'Uploading...'}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-line h-2 rounded-full overflow-hidden">
              <div
                className="bg-gold h-full transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {imageUrl && !uploading && (
          <div className="mt-3 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <span>✓</span>
            <span>{locale === 'fa' ? 'تصویر با موفقیت آپلود شد' : 'Image uploaded successfully'}</span>
          </div>
        )}

        {error && (
          <div className="mt-3 text-xs text-red-500">
            {error}
          </div>
        )}

        <input type="hidden" name="img" value={imageUrl} />
      </div>

      <input name="title" required placeholder={L(locale, 'عنوان', 'Title')} className="input" />
      <textarea name="prompt" required rows={5} placeholder={L(locale, 'متن پرامپت', 'Prompt text')} className="input resize-none" />
      <textarea name="desc" rows={2} placeholder={L(locale, 'توضیح کوتاه (اختیاری)', 'Short description (optional)')} className="input resize-none" />

      {categories.length > 0 && (
        <select name="category" className="input">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{L(locale, c.nameFa, c.nameEn)}</option>
          ))}
        </select>
      )}

      <button
        type="submit"
        disabled={uploading || !imageUrl}
        className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading 
          ? L(locale, 'در حال آپلود تصویر...', 'Uploading image...') 
          : L(locale, 'ارسال برای بررسی', 'Submit for review')}
      </button>
    </form>
  )
}