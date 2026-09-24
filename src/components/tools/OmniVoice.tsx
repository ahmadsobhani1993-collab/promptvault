'use client'

import { useState, useRef, ChangeEvent } from 'react'

export default function OmniVoice() {
  const [text, setText] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [resultAudio, setResultAudio] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // سقف حجم ۲ مگابایت برای جلوگیری قطعی از خطای 413 ورسل
      if (file.size > 2 * 1024 * 1024) {
        alert(`حجم این فایل ${(file.size / (1024 * 1024)).toFixed(1)} مگابایت است. لطفاً یک نمونه صدای کوتاه زیر ۲ مگابایت (حدود ۵ تا ۱۰ ثانیه) انتخاب کنید.`)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }
      setAudioFile(file)
      setServerError(null)
    }
  }

  const handleGenerate = async () => {
    if (!text.trim()) {
      alert('لطفاً ابتدا متن مورد نظر را بنویسید.')
      return
    }

    setLoading(true)
    setResultAudio(null)
    setServerError(null)

    try {
      const fd = new FormData()
      fd.append('text', text)
      if (audioFile) {
        fd.append('audio', audioFile)
      }

      const res = await fetch('/api/tts-clone', {
        method: 'POST',
        body: fd,
      })

      if (res.status === 413) {
        throw new Error('خطای ۴۱۳: حجم فایل صوتی برای ارسال مستقیم زیاد است.')
      }

      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        const msg = data?.error || `خطای سرور صوتی (${res.status})`
        setServerError(msg)
        alert(`علت خطا: ${msg}`)
        return
      }

      if (data?.data) {
        setResultAudio(data.data)
      } else {
        setServerError('خروجی صوتی دریافت نشد.')
      }
    } catch (err: any) {
      const msg = err?.message || 'خطا در برقراری ارتباط'
      setServerError(msg)
      alert(`خطا: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-6 text-white shadow-xl">
      <h2 className="mb-2 text-2xl font-black text-amber-400">تبدیل متن به گفتار و شبیه‌سازی صدا (OmniVoice)</h2>
      <p className="mb-6 text-xs text-zinc-400">
        متن خود را وارد کنید؛ برای شبیه‌سازی صدا می‌توانید یک فایل صوتی کوتاه (حداکثر ۲ مگابایت) انتخاب نمایید.
      </p>

      <div className="mb-4">
        <label className="mb-2 block text-xs text-zinc-300">متن مورد نظر:</label>
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="متن خود را اینجا تایپ کنید..."
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
        />
      </div>

      <div className="mb-6">
        <label className="mb-2 block text-xs text-zinc-300">نمونه صدا برای شبیه‌سازی (اختیاری):</label>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="audio/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-medium text-zinc-300 hover:border-amber-500 hover:text-amber-400"
          >
            {audioFile ? `🎵 ${audioFile.name}` : '📁 انتخاب فایل صوتی کوتاه'}
          </button>
          {audioFile && (
            <button
              type="button"
              onClick={() => {
                setAudioFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="text-xs text-red-400 hover:underline"
            >
              حذف
            </button>
          )}
        </div>
      </div>

      {serverError && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300 leading-relaxed">
          ⚠️ {serverError}
        </div>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={handleGenerate}
        className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
      >
        {loading ? 'در حال شبیه‌سازی و تولید گفتار...' : 'تولید صدا'}
      </button>

      {resultAudio && (
        <div className="mt-6 rounded-xl border border-white/10 bg-zinc-900 p-4">
          <span className="mb-2 block text-xs text-amber-400">نتیجه صوت تولید شده:</span>
          <audio src={resultAudio} controls autoPlay className="w-full" />
        </div>
      )}
    </div>
  )
}
