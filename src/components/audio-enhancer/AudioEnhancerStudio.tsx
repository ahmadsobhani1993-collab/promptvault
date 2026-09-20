'use client'

import React, { useState, useRef } from 'react'
import {
  processAudioBuffer,
  bufferToStandardAudio,
  formatAudioTime,
  ProcessingOptions,
} from './audio-utils'

export default function AudioEnhancerStudio() {
  const [file, setFile] = useState<File | null>(null)
  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null)
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null)

  const [options, setOptions] = useState<ProcessingOptions>({
    removeNoise: true,
    boostVolume: true,
    voiceTone: 'original',
    noiseReductionIntensity: 'balanced',
  })

  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')

  const [isPlaying, setIsPlaying] = useState(false)
  const [playEnhanced, setPlayEnhanced] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const startTimeRef = useRef<number>(0)
  const pauseOffsetRef = useRef<number>(0)
  const animFrameRef = useRef<number | null>(null)

  // بارگذاری فایل و تبدیل به AudioBuffer
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    stopAudio()
    setFile(selected)
    setProcessedBuffer(null)
    setLoading(true)
    setLoadingText('در حال تحلیل امواج صوتی در مرورگر...')

    try {
      const arrayBuffer = await selected.arrayBuffer()
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioCtxRef.current = ctx

      const decoded = await ctx.decodeAudioData(arrayBuffer)
      setOriginalBuffer(decoded)
      setDuration(decoded.duration)
      setCurrentTime(0)
      pauseOffsetRef.current = 0
    } catch {
      alert('فرمت فایل نامعتبر است یا توسط مرورگر پشتیبانی نمی‌شود.')
      setFile(null)
    } finally {
      setLoading(false)
    }
  }

  // اجرای پردازش فیلتر و بازسازی صوت
  const handleStartProcessing = async () => {
    if (!originalBuffer) return
    stopAudio()
    setLoading(true)
    setLoadingText('در حال اجرای مدل حذف نویز تطبیقی و بهینه‌سازی کلام...')

    await new Promise((r) => setTimeout(r, 60))

    try {
      const result = await processAudioBuffer(originalBuffer, options)
      setProcessedBuffer(result)
      setPlayEnhanced(true)
      setDuration(result.duration)
      setCurrentTime(0)
      pauseOffsetRef.current = 0
    } catch {
      alert('خطا در پردازش صوت.')
    } finally {
      setLoading(false)
    }
  }

  // کنترل پخش زنده صوت
  const playAudio = (useEnhanced = playEnhanced) => {
    const targetBuffer = useEnhanced ? (processedBuffer || originalBuffer) : originalBuffer
    if (!targetBuffer) return

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()

    const source = ctx.createBufferSource()
    source.buffer = targetBuffer
    source.connect(ctx.destination)

    const offset = pauseOffsetRef.current
    source.start(0, offset)
    startTimeRef.current = ctx.currentTime - offset
    sourceNodeRef.current = source
    setIsPlaying(true)

    const tick = () => {
      if (!audioCtxRef.current) return
      const cur = audioCtxRef.current.currentTime - startTimeRef.current
      if (cur >= duration) {
        stopAudio()
      } else {
        setCurrentTime(cur)
        animFrameRef.current = requestAnimationFrame(tick)
      }
    }
    animFrameRef.current = requestAnimationFrame(tick)
  }

  const pauseAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop()
        sourceNodeRef.current.disconnect()
      } catch {}
    }
    pauseOffsetRef.current = currentTime
    setIsPlaying(false)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
  }

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop()
        sourceNodeRef.current.disconnect()
      } catch {}
    }
    setIsPlaying(false)
    setCurrentTime(0)
    pauseOffsetRef.current = 0
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
  }

  // دانلود خروجی نهایی با فرمت واقعی
  const handleExport = async () => {
    const targetBuffer = processedBuffer || originalBuffer
    if (!targetBuffer || !file) return

    setLoading(true)
    setLoadingText('در حال آماده‌سازی و فشرده‌سازی خروجی استاندارد...')

    try {
      const { blob, fileName } = await bufferToStandardAudio(targetBuffer, file.name)
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch {
      alert('خطا در دانلود خروجی.')
    } finally {
      setLoading(false)
    }
  }

  const getFileExtension = () => {
    if (!file) return 'صوتی'
    const match = file.name.match(/\.([0-9a-z]+)$/i)
    return match ? match[1].toUpperCase() : 'WAV'
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* هدر */}
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">
          استودیو تقویت و <span className="text-gold-bright">شفاف‌ساز صدا</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          حذف تطبیقی نویز محیطی، اکولایزر اصلاحی و تنظیم استودیویی کلام بدون خروج اطلاعات از مرورگر
        </p>
      </div>

      {/* بخش انتخاب فایل */}
      {!file && (
        <div className="rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-950/60 p-10 text-center transition hover:border-gold/50">
          <input
            type="file"
            id="audio-upload"
            accept="audio/*,video/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={loading}
          />
          <label htmlFor="audio-upload" className="flex cursor-pointer flex-col items-center justify-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-gold/10 text-3xl text-gold-bright">
              🎙️
            </span>
            <span className="mt-4 text-base font-bold text-white">
              انتخاب فایل صوتی یا ویدیویی
            </span>
            <span className="mt-1 text-xs text-zinc-500">
              پردازش ۱۰۰٪ لوکال و بدون بارگذاری روی سرور
            </span>
          </label>
        </div>
      )}

      {/* وضعیت لودینگ */}
      {loading && (
        <div className="rounded-2xl border border-gold/30 bg-gold/5 p-6 text-center text-sm text-gold-bright animate-pulse">
          ⚡ {loadingText}
        </div>
      )}

      {/* گزینه‌های تنظیم پیش از پردازش */}
      {file && !processedBuffer && !loading && (
        <div className="space-y-6 rounded-3xl border border-zinc-800 bg-[#120f0c] p-6 shadow-2xl">
          <div className="border-b border-zinc-800 pb-3">
            <p className="text-sm font-bold text-white truncate">فایل: {file.name}</p>
            <p className="text-xs text-zinc-500">مدت زمان: {formatAudioTime(duration)}</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gold-bright">تنظیمات زنجیره پردازش صدا:</h3>

            {/* تنظیم نویز */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="block text-sm font-bold text-white">حذف هوشمند و تطبیقی نویز</span>
                  <span className="block text-xs text-zinc-400">حذف صدای کولر، فن، هیس و نویزهای فرکانسی بدون قطع کلمات</span>
                </div>
                <input
                  type="checkbox"
                  checked={options.removeNoise}
                  onChange={(e) => setOptions({ ...options, removeNoise: e.target.checked })}
                  className="h-5 w-5 accent-gold cursor-pointer"
                />
              </label>

              {options.removeNoise && (
                <div className="flex gap-2 pt-2 border-t border-zinc-800/60">
                  {(['mild', 'balanced', 'aggressive'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setOptions({ ...options, noiseReductionIntensity: lvl })}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition ${
                        options.noiseReductionIntensity === lvl
                          ? 'border-gold bg-gold/15 text-gold-bright font-bold'
                          : 'border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {lvl === 'mild' ? 'ملایم' : lvl === 'balanced' ? 'متعادل (پیش‌فرض)' : 'قوی'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* تنظیم بلندی صدا */}
            <label className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 cursor-pointer">
              <div>
                <span className="block text-sm font-bold text-white">افزایش حجم هوشمند (Loudness & Limiter)</span>
                <span className="block text-xs text-zinc-400">بهینه‌سازی داینامیک بدون دیستورشن و بدون افزایش سطح نویز</span>
              </div>
              <input
                type="checkbox"
                checked={options.boostVolume}
                onChange={(e) => setOptions({ ...options, boostVolume: e.target.checked })}
                className="h-5 w-5 accent-gold cursor-pointer"
              />
            </label>

            {/* تنظیم جنس صدا */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <span className="block text-sm font-bold text-white">رنگ و کاراکتر صدا:</span>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { id: 'original', label: 'طبیعی', icon: '🌿' },
                  { id: 'studio', label: 'استودیویی (شفاف)', icon: '💎' },
                  { id: 'male', label: 'بم پادکستی', icon: '🎙️' },
                  { id: 'female', label: 'زیر و باز', icon: '🌸' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOptions({ ...options, voiceTone: item.id as any })}
                    className={`flex flex-col items-center justify-center rounded-lg border p-2.5 text-xs font-semibold transition ${
                      options.voiceTone === item.id
                        ? 'border-gold bg-gold/10 text-gold-bright'
                        : 'border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span className="mt-1">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={() => {
                setFile(null)
                setOriginalBuffer(null)
              }}
              className="text-xs text-zinc-500 hover:text-red-400"
            >
              انصراف
            </button>

            <button
              type="button"
              onClick={handleStartProcessing}
              className="btn-primary px-8 py-3 text-sm font-bold shadow-lg shadow-gold/20"
            >
              🚀 شروع پردازش مهندسی‌شده
            </button>
          </div>
        </div>
      )}

      {/* پلیر مقایسه‌ای و دانلود */}
      {processedBuffer && (
        <div className="space-y-6 rounded-3xl border border-zinc-800 bg-[#120f0c] p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <p className="text-sm font-bold text-white truncate max-w-xs">{file?.name}</p>
              <p className="text-xs text-zinc-500">پردازش با موفقیت پایان یافت</p>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-zinc-900 p-1 border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setPlayEnhanced(false)
                  if (isPlaying) { pauseAudio(); setTimeout(() => playAudio(false), 30) }
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  !playEnhanced ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'text-zinc-400 hover:text-white'
                }`}
              >
                صدای خام اولیه
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlayEnhanced(true)
                  if (isPlaying) { pauseAudio(); setTimeout(() => playAudio(true), 30) }
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  playEnhanced ? 'bg-gold/20 text-gold-bright border border-gold/40' : 'text-zinc-400 hover:text-white'
                }`}
              >
                صدای بهینه‌شده ✨
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={currentTime}
              onChange={(e) => {
                const target = Number(e.target.value)
                pauseOffsetRef.current = target
                setCurrentTime(target)
                if (isPlaying) {
                  pauseAudio()
                  setTimeout(() => playAudio(), 20)
                }
              }}
              className="w-full accent-gold cursor-pointer"
            />
            <div className="flex justify-between text-xs text-zinc-500">
              <span>{formatAudioTime(currentTime)}</span>
              <span>{formatAudioTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 py-1">
            <button
              type="button"
              onClick={isPlaying ? pauseAudio : () => playAudio()}
              className="grid h-12 w-12 place-items-center rounded-full bg-gold text-xl text-black font-bold shadow-lg shadow-gold/20 transition hover:scale-105"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button
              type="button"
              onClick={stopAudio}
              className="grid h-10 w-10 place-items-center rounded-full border border-zinc-700 bg-zinc-800 text-sm text-zinc-300 transition hover:text-white"
            >
              ⏹
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={() => {
                stopAudio()
                setProcessedBuffer(null)
              }}
              className="text-xs text-zinc-400 hover:text-white"
            >
              🔄 بازگشت و تغییر پارامترها
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={loading}
              className="btn-primary flex items-center gap-2 px-6 py-2.5 text-xs font-bold shadow-lg shadow-gold/20"
            >
              <span>⬇️</span>
              <span>دانلود فایل بهینه‌شده ({getFileExtension()})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
