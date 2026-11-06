'use client'

import { useState, useRef } from 'react'
import { L } from '@/lib/data'
import { type Locale } from '@/lib/i18n'
import { submitPromptAction } from '@/app/submit/actions'

type Category = {
  id: string
  slug: string
  nameFa: string
  nameEn: string
}

type Props = {
  categories: Category[]
  locale: Locale
}

function createVideoThumbnail(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const objectUrl = URL.createObjectURL(file)
    let settled = false
    const timeout = window.setTimeout(() => finish(null), 15000)

    const finish = (thumbnail: Blob | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(objectUrl)
      if (thumbnail) resolve(thumbnail)
      else reject(new Error('Video thumbnail could not be generated'))
    }

    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.onloadedmetadata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        finish(null)
        return
      }
      video.currentTime = Math.min(Math.max(video.duration * 0.15, 0.1), video.duration / 2)
    }
    video.onseeked = () => {
      if (!video.videoWidth || !video.videoHeight) {
        finish(null)
        return
      }

      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 960 / video.videoWidth)
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      const context = canvas.getContext('2d')
      if (!context) {
        finish(null)
        return
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(finish, 'image/jpeg', 0.84)
    }
    video.onerror = () => finish(null)
    video.src = objectUrl
  })
}

export default function SubmitForm({ categories, locale }: Props) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [imageUrl, setImageUrl] = useState('')
  const [mediaType, setMediaType] = useState<'IMAGE' | 'VIDEO'>('IMAGE')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isVideo = file.type.startsWith('video/')
    if (!file.type.startsWith('image/') && !isVideo) {
      setError(L(locale, 'فایل باید تصویر یا ویدیو باشد', 'Choose an image or video file'))
      return
    }

    if (file.size > (isVideo ? 10 : 3) * 1024 * 1024) {
      setError(
        isVideo
          ? L(locale, 'حجم ویدیو باید کمتر از ۱۰ مگابایت باشد', 'Video must be under 10MB')
          : L(locale, 'حجم تصویر باید کمتر از ۳ مگابایت باشد', 'Image must be under 3MB')
      )
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setError('')
    setMediaType(isVideo ? 'VIDEO' : 'IMAGE')
    if (isVideo) {
      const videoCategory = categories.find((category) => category.slug === 'video')
      if (videoCategory) setCategoryId(videoCategory.id)
    }
    setUploading(true)
    setProgress(0)

    const formData = new FormData()
    formData.append('file', file)

    try {
      if (isVideo) {
        try {
          const thumbnail = await createVideoThumbnail(file)
          formData.append('thumbnail', thumbnail, 'thumbnail.jpg')
        } catch {
          setError(L(locale, 'پیش‌نمایش ویدیو ساخته نشد؛ لطفاً یک ویدیوی سازگارتر انتخاب کنید.', 'Could not create a video thumbnail. Please choose a compatible video.'))
          setUploading(false)
          return
        }
      }

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
              const savedUrl = res.posterUrl
                ? `${res.url}#poster=${encodeURIComponent(res.posterUrl)}`
                : res.url
              setImageUrl(savedUrl)
              setMediaType(res.mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE')
            } else {
              setError(L(locale, 'خطا در آپلود فایل', 'File upload failed'))
            }
          } catch (err) {
            setError(locale === 'fa' ? 'خطا در پردازش پاسخ سرور' : 'Error parsing server response')
          }
        } else {
          setError(L(locale, 'خطا در آپلود فایل', 'File upload failed'))
        }
        setUploading(false)
      }

      xhr.onerror = () => {
        setError(locale === 'fa' ? 'خطا در اتصال به سرور' : 'Connection error')
        setUploading(false)
      }

      xhr.send(formData)
    } catch (err) {
      setError(L(locale, 'خطا در آپلود فایل', 'File upload failed'))
      setUploading(false)
    }
  }

  return (
    <form action={submitPromptAction} className="card mt-8 space-y-5 p-6">
      <div>
        <label className="block text-sm font-medium mb-2">
          {L(locale, 'آپلود تصویر یا ویدیو (تصویر تا ۳ ویدیو تا ۱۰ مگابایت)', 'Upload image or video (image up to 3MB, video up to 10MB)')}
        </label>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime"
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
          <div className="mt-3">
            {mediaType === 'VIDEO' ? (
              <video
                src={imageUrl}
                muted
                playsInline
                controls
                preload="metadata"
                onLoadedMetadata={(event) => {
                  const video = event.currentTarget
                  if (Number.isFinite(video.duration) && video.duration > 0) {
                    video.currentTime = Math.min(0.1, video.duration / 2)
                  }
                }}
                className="max-h-64 w-full rounded-lg bg-black object-contain"
              />
            ) : (
              <img src={imageUrl} alt="" className="max-h-64 w-full rounded-lg object-contain" />
            )}
            <p className="mt-2 text-xs text-green-600 dark:text-green-400">
              {L(locale, 'فایل با موفقیت آپلود شد', 'File uploaded successfully')}
            </p>
          </div>
        )}

        {error && (
          <div className="mt-3 text-xs text-red-500">
            {error}
          </div>
        )}

        <input type="hidden" name="img" value={imageUrl} />
        <input type="hidden" name="mediaType" value={mediaType} />
      </div>

      <input name="title" required placeholder={L(locale, 'عنوان', 'Title')} className="input" />
      <textarea name="prompt" required rows={5} placeholder={L(locale, 'متن پرامپت', 'Prompt text')} className="input resize-none" />
      <textarea name="desc" rows={2} placeholder={L(locale, 'توضیح کوتاه (اختیاری)', 'Short description (optional)')} className="input resize-none" />

      {categories.length > 0 && (
        <select name="category" className="input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
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