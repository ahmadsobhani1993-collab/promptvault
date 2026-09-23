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
      if (file.size > 3 * 1024 * 1024) {
        alert('حجم فایل صوتی بیش از حد مجاز است (حداکثر ۳ مگابایت).')
        return
      }
      setAudioFile(file)
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

      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        const msg = data?.error || `ارور سرور کد ${res.status}`
        setServerError(msg)
        alert(`علت خطا: ${msg}`)
        return
      }

      let audioUrl = ''
      if (Array.isArray(data.data)) {
        const item = data.data[0]
        audioUrl = typeof item === 'string' ? item : item?.url || item?.path
      } else if (data.data?.url) {
        audioUrl = data.data.url
      }

      if (audioUrl) {
        setResultAudio(audioUrl)
      }
    } catch (err: any) {
      const msg = err?.message || 'عدم دسترسی به سرور'
      setServerError(msg)
      alert(`خطا در ارتباط: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-6 text-white shadow-xl">
      <h2 className="mb-2 text-2xl font-black text-amber-400">تبدیل متن به گفتار و شبیه‌سازی صدا</h2>
      <p className="mb-6 text-xs text-zinc-400">
        متن را بنویسید و در صورت تمایل فایل نمونه صدای کوتاه بارگذاری کنید.
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
        <label className="mb-2 block text-xs text-zinc-300">نمونه صدا برای کلون/شبیه‌سازی (اختیاری):</label>
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
            {audioFile ? `🎵 ${audioFile.name}` : '📁 انتخاب فایل صوتی'}
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
              حذف فایل
            </button>
          )}
        </div>
      </div>

      {serverError && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
          ⚠️ {serverError}
        </div>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={handleGenerate}
        className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
      >
        {loading ? 'در حال شبیه‌سازی و تولید صدا...' : 'شروع تبدیل به صدا'}
      </button>

      {resultAudio && (
        <div className="mt-6 rounded-xl border border-white/10 bg-zinc-900 p-4">
          <span className="mb-2 block text-xs text-amber-400">صدای تولید شده:</span>
          <audio src={resultAudio} controls className="w-full" />
        </div>
      )}
    </div>
  )
}
