'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { removeBackground } from '@imgly/background-removal'

type Mode = 'remove_bg' | 'remove_subject'

export default function BackgroundRemover() {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [resultSrc, setResultSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [mode, setMode] = useState<Mode>('remove_bg')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImageSrc(url)
    setResultSrc(null)
    setProgress(0)
  }

  const processImage = async () => {
    if (!imageSrc) return
    setLoading(true)
    setProgress(10)
    setStatusText('در حال راه‌اندازی مدل...')

    try {
      const blob = await removeBackground(imageSrc, {
        progress: (key: string, current: number, total: number) => {
          if (total > 0) {
            const p = Math.round((current / total) * 100)
            setProgress(p)
            setStatusText(key.includes('fetch') ? `دانلود وزن‌های مدل (${p}%)...` : `پردازش پیکسل‌ها (${p}%)...`)
          }
        },
        output: {
          format: 'image/png',
          quality: 0.95,
        },
      })

      if (mode === 'remove_subject') {
        setStatusText('معکوس‌سازی لایه و حذف سوژه...')
        const invertedBlob = await invertImageAlpha(imageSrc, blob)
        setResultSrc(URL.createObjectURL(invertedBlob))
      } else {
        setResultSrc(URL.createObjectURL(blob))
      }

      setStatusText('تکمیل شد!')
    } catch (err: any) {
      console.error('BG Removal Error:', err)
      alert('خطا در پردازش تصویر: ' + (err?.message || 'مشکلی پیش آمد'))
    } finally {
      setLoading(false)
    }
  }

  const invertImageAlpha = async (origUrl: string, cutoutBlob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const origImg = new Image()
      const cutImg = new Image()
      origImg.crossOrigin = 'anonymous'
      cutImg.crossOrigin = 'anonymous'

      origImg.src = origUrl
      cutImg.src = URL.createObjectURL(cutoutBlob)

      let loaded = 0
      const onImageLoad = () => {
        loaded++
        if (loaded < 2) return

        const canvas = document.createElement('canvas')
        canvas.width = origImg.naturalWidth
        canvas.height = origImg.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas context unavailable'))

        ctx.drawImage(origImg, 0, 0)
        const origData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = canvas.width
        tempCanvas.height = canvas.height
        const tempCtx = tempCanvas.getContext('2d')
        if (!tempCtx) return reject(new Error('Temp context unavailable'))
        tempCtx.drawImage(cutImg, 0, 0)
        const cutData = tempCtx.getImageData(0, 0, canvas.width, canvas.height)

        for (let i = 0; i < origData.data.length; i += 4) {
          const cutAlpha = cutData.data[i + 3]
          origData.data[i + 3] = 255 - cutAlpha
        }

        ctx.putImageData(origData, 0, 0)
        canvas.toBlob((b) => {
          if (b) resolve(b)
          else reject(new Error('Failed to generate blob'))
        }, 'image/png')
      }

      origImg.onload = onImageLoad
      cutImg.onload = onImageLoad
      origImg.onerror = reject
      cutImg.onerror = reject
    })
  }

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-white shadow-xl">
      <h2 className="mb-2 text-2xl font-black text-amber-400">حذف هوشمند پس‌زمینه و سوژه (۱۰۰٪ کلاینت)</h2>
      <p className="mb-6 text-sm text-zinc-400">پردازش بدون سرور و مستقیماً روی مرورگر شما با WebAssembly/WebGPU انجام می‌شود.</p>

      <div className="mb-6 flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="mode"
            checked={mode === 'remove_bg'}
            onChange={() => setMode('remove_bg')}
            className="accent-amber-500"
          />
          <span>حذف پس‌زمینه (نگه‌داشتن سوژه)</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="mode"
            checked={mode === 'remove_subject'}
            onChange={() => setMode('remove_subject')}
            className="accent-amber-500"
          />
          <span>حذف سوژه (نگه‌داشتن پس‌زمینه)</span>
        </label>
      </div>

      <div className="mb-6">
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/60 px-6 py-4 text-center font-medium transition hover:border-amber-500 hover:text-amber-400"
        >
          {imageSrc ? 'تغییر عکس انتخابی' : '📁 انتخاب تصویر از سیستم'}
        </button>
      </div>

      {imageSrc && (
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col items-center">
            <span className="mb-2 text-xs text-zinc-400">تصویر اصلی</span>
            <div className="max-h-80 overflow-hidden rounded-xl border border-zinc-800 bg-black/40">
              <img src={imageSrc} alt="Original" className="max-h-80 object-contain" />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <span className="mb-2 text-xs text-zinc-400">نتیجه پردازش شده</span>
            <div
              className="flex h-full min-h-[160px] w-full items-center justify-center rounded-xl border border-zinc-800"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
              }}
            >
              {resultSrc ? (
                <img src={resultSrc} alt="Result" className="max-h-80 object-contain" />
              ) : (
                <span className="text-xs text-zinc-500">در انتظار پردازش...</span>
              )}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="mb-6">
          <div className="mb-1 flex justify-between text-xs text-zinc-400">
            <span>{statusText}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full bg-amber-500 transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <button
          disabled={!imageSrc || loading}
          onClick={processImage}
          className="rounded-xl bg-amber-500 px-6 py-3 font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? 'در حال پردازش...' : 'شروع پردازش هوش مصنوعی'}
        </button>

        {resultSrc && (
          <a
            href={resultSrc}
            download="processed-image.png"
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-6 py-3 font-bold text-white transition hover:bg-zinc-700"
          >
            دانلود تصویر با فرمت PNG
          </a>
        )}
      </div>
    </div>
  )
}
