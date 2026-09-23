'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { removeBackground } from '@imgly/background-removal'

export default function BackgroundRemover() {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [resultSrc, setResultSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImageSrc(url)
    setResultSrc(null)
    setProgress(0)
    setStatus('')
  }

  const processImage = async () => {
    if (!imageSrc) return
    setLoading(true)
    setProgress(5)
    setStatus('آماده‌سازی مدل هوش مصنوعی با بالاترین دقت...')

    try {
      const blob = await removeBackground(imageSrc, {
        model: 'isnet', // استفاده از مدل کامل و حداکثر دقت در لبه‌ها و جزئیات
        progress: (key: string, current: number, total: number) => {
          if (total > 0) {
            const p = Math.round((current / total) * 100)
            setProgress(p)
            if (key.includes('fetch')) {
              setStatus(`دانلود موتور پردازش دقیق (${p}%)...`)
            } else {
              setStatus(`آنالیز و تفکیک لبه‌های تصویر (${p}%)...`)
            }
          }
        },
        output: {
          format: 'image/png',
          quality: 1,
        },
      })

      setResultSrc(URL.createObjectURL(blob))
      setStatus('انجام شد!')
    } catch (err: any) {
      console.error('BG Removal Error:', err)
      alert('خطا در پردازش تصویر. لطفاً تصویر دیگری انتخاب کنید.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-zinc-950 p-6 text-white shadow-2xl">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-black text-amber-400">حذف پس‌زمینه تصویر (کیفیت حداکثری)</h2>
        <p className="mt-1 text-xs text-white/50">
          پردازش روی دستگاه شما با مدل تفکیک لبه‌های دقیق
        </p>
      </div>

      <div className="mb-6 flex justify-center">
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl border border-dashed border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white/80 transition hover:border-amber-500/50 hover:text-amber-300"
        >
          {imageSrc ? 'تغییر عکس انتخابی' : '📁 انتخاب تصویر'}
        </button>
      </div>

      {imageSrc && (
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col items-center">
            <span className="mb-2 text-xs text-white/40">تصویر اصلی</span>
            <div className="flex h-80 w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/40 p-2">
              <img src={imageSrc} alt="Original" className="max-h-full max-w-full object-contain rounded-lg" />
            </div>
          </div>

          <div className="flex flex-col items-center">
            <span className="mb-2 text-xs text-white/40">نتیجه نهایی</span>
            <div
              className="flex h-80 w-full items-center justify-center rounded-xl border border-white/10 p-2"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
              }}
            >
              {resultSrc ? (
                <img src={resultSrc} alt="Result" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-white/30">در انتظار آغاز پردازش...</span>
              )}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="mb-6">
          <div className="mb-1.5 flex justify-between text-xs text-white/70">
            <span>{status}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full bg-amber-500 transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4">
        <button
          disabled={!imageSrc || loading}
          onClick={processImage}
          className="rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-40"
        >
          {loading ? 'در حال پردازش...' : 'شروع پردازش هوش مصنوعی'}
        </button>

        {resultSrc && (
          <a
            href={resultSrc}
            download="cutout-hq.png"
            className="rounded-xl border border-white/10 bg-white/10 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
          >
            دانلود تصویر PNG با پس‌زمینه شفاف
          </a>
        )}
      </div>
    </div>
  )
}
