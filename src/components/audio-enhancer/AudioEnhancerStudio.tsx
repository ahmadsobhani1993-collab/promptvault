'use client'

import React, { useState, useRef } from 'react'
import {
  processAudioBuffer,
  bufferToStandardAudio,
  formatAudioTime,
  ProcessingOptions,
  SAMPLE_RATE,
} from './audio-utils'

export default function AudioEnhancerStudio() {
  const [file, setFile] = useState<File | null>(null)
  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null)
  const [previewBuffer, setPreviewBuffer] = useState<AudioBuffer | null>(null)
  const [fullProcessedBuffer, setFullProcessedBuffer] = useState<AudioBuffer | null>(null)

  const [options, setOptions] = useState<ProcessingOptions>({
    attenuationLevel: 65, // درصد اسلایدر
    loudnessNormalization: true,
    voiceEq: true,
  })

  const [outputFormat, setOutputFormat] = useState<string>('auto')

  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)

  const [isPlaying, setIsPlaying] = useState(false)
  const [playEnhanced, setPlayEnhanced] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const startTimeRef = useRef<number>(0)
  const pauseOffsetRef = useRef<number>(0)
  const animFrameRef = useRef<number | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    stopAudio()
    setFile(selected)
    setPreviewBuffer(null)
    setFullProcessedBuffer(null)
    setLoading(true)
    setProgressPercent(0)
    setLoadingText('در حال دیکود فایل صوتی...')

    try {
      const arrayBuffer = await selected.arrayBuffer()
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE })
      audioCtxRef.current = ctx

      const decoded = await ctx.decodeAudioData(arrayBuffer)
      setOriginalBuffer(decoded)
      setDuration(decoded.duration)
      setCurrentTime(0)
      pauseOffsetRef.current = 0
    } catch {
      alert('فرمت فایل نامعتبر است یا پشتیبانی نمی‌شود.')
      setFile(null)
    } finally {
      setLoading(false)
    }
  }

  // پردازش پیش‌نمایش ۶۰ ثانیه
  const handlePreview = async () => {
    if (!originalBuffer) return
    stopAudio()
    setLoading(true)
    setProgressPercent(10)
    setLoadingText('در حال آماده‌سازی پیش‌نمایش ۶۰ ثانیه‌ای...')

    try {
      const result = await processAudioBuffer(originalBuffer, options, 60, (pct, status) => {
        setProgressPercent(pct)
        setLoadingText(status)
      })
      setPreviewBuffer(result)
      setFullProcessedBuffer(null)
      setPlayEnhanced(true)
      setDuration(result.duration)
      setCurrentTime(0)
      pauseOffsetRef.current = 0
    } catch (err: any) {
      alert(`خطا در پردازش پیش‌نمایش: ${err?.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  // پردازش کل فایل
  const handleProcessFull = async () => {
    if (!originalBuffer) return
    stopAudio()
    setLoading(true)
    setProgressPercent(10)
    setLoadingText('در حال پردازش کل فایل صوتی با DeepFilterNet3...')

    try {
      const result = await processAudioBuffer(originalBuffer, options, null, (pct, status) => {
        setProgressPercent(pct)
        setLoadingText(status)
      })
      setFullProcessedBuffer(result)
      setPlayEnhanced(true)
      setDuration(result.duration)
      setCurrentTime(0)
      pauseOffsetRef.current = 0
    } catch (err: any) {
      alert(`خطا در پردازش کل فایل: ${err?.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  const activeBuffer = fullProcessedBuffer || previewBuffer

  const playAudio = (useEnhanced = playEnhanced) => {
    const targetBuffer = useEnhanced ? activeBuffer : originalBuffer
    if (!targetBuffer) return

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE })
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

  const handleExport = async () => {
    const targetBuffer = fullProcessedBuffer || previewBuffer || originalBuffer
    if (!targetBuffer || !file) return

    setLoading(true)
    setLoadingText('در حال آماده‌سازی و فشرده‌سازی خروجی...')

    try {
      const format = outputFormat === 'auto' ? undefined : outputFormat
      const { blob, fileName } = await bufferToStandardAudio(targetBuffer, file.name, format)
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

  const getResolvedInputFormat = () => {
    if (!file) return 'MP3'
    const match = file.name.match(/\.([0-9a-z]+)$/i)
    return match ? match[1].toUpperCase() : 'MP3'
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* هدر */}
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">
          استودیو تقویت و <span className="text-gold-bright">شفاف‌ساز صدا</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          حذف نویز و ارتقای کلام با مدل هوش مصنوعی DeepFilterNet3 کاملاً در مرورگر شما
        </p>
      </div>

      {/* بنر تضمین پردازش محلی */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center text-xs text-emerald-400">
        تمامی پردازش‌ها به صورت ۱۰۰٪ محلی در مرورگر شما انجام می‌شود و فایل صوتی از دستگاه خارج نمی‌شود.
      </div>

      {/* آپلود فایل */}
      {!file && (
        <div className="rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-950/60 p-8 text-center transition hover:border-gold/50">
          <input
            type="file"
            id="audio-upload"
            accept="audio/*,video/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={loading}
          />
          <label htmlFor="audio-upload" className="flex cursor-pointer flex-col items-center justify-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-gold/10 text-2xl text-gold-bright">
              🎙️
            </span>
            <span className="mt-3 text-sm font-bold text-white">انتخاب یا رها کردن فایل صوتی</span>
            <span className="mt-1 text-xs text-zinc-500">پشتیبانی از MP3, WAV, M4A, AAC</span>
          </label>
        </div>
      )}

      {/* وضعیت لودینگ */}
      {loading && (
        <div className="space-y-3 rounded-2xl border border-gold/30 bg-gold/5 p-6 text-center">
          <p className="text-sm font-bold text-gold-bright animate-pulse">⚡ {loadingText}</p>
          {progressPercent > 0 && (
            <div className="mx-auto h-2 w-full max-w-md overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-gold transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* پنل تنظیمات مشابه عکس چهارم */}
      {file && !activeBuffer && !loading && (
        <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl">
          {/* نام فایل */}
          <div>
            <span className="block text-xs font-semibold text-zinc-400 mb-2">فایل صوتی انتخابی:</span>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
              <span className="text-sm font-bold text-white">{file.name}</span>
              <span className="block text-xs text-zinc-500 mt-1">مدت زمان: {formatAudioTime(duration)}</span>
            </div>
          </div>

          {/* اسلایدر شدت حذف نویز */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-zinc-300">شدت حذف نویز (Noise reduction level):</span>
              <span className="text-gold-bright font-bold">{options.attenuationLevel}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              step={1}
              value={options.attenuationLevel}
              onChange={(e) => setOptions({ ...options, attenuationLevel: Number(e.target.value) })}
              className="w-full accent-gold cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>ملایم (Light)</span>
              <span>قوی (Heavy)</span>
            </div>
          </div>

          {/* گزینه‌های بهینه‌سازی صدا */}
          <div className="space-y-3 border-t border-zinc-800/80 pt-4">
            <span className="block text-xs font-semibold text-zinc-400">بهینه‌سازی کلام (Voice optimization):</span>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={options.loudnessNormalization}
                onChange={(e) => setOptions({ ...options, loudnessNormalization: e.target.checked })}
                className="h-4 w-4 accent-gold cursor-pointer rounded"
              />
              <div>
                <span className="block text-xs font-bold text-white">نرمال‌سازی بلندی صدا (Loudness normalization)</span>
                <span className="block text-[11px] text-zinc-500">تنظیم پیوسته سطح صدا بر اساس استاندارد پادکست و گفتار</span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={options.voiceEq}
                onChange={(e) => setOptions({ ...options, voiceEq: e.target.checked })}
                className="h-4 w-4 accent-gold cursor-pointer rounded"
              />
              <div>
                <span className="block text-xs font-bold text-white">اکولایزر وضوح کلام (Voice EQ)</span>
                <span className="block text-[11px] text-zinc-500">حذف فرکانس‌های بم مزاحم (Rumble) و افزایش وضوح و شفافیت گفتار</span>
              </div>
            </label>
          </div>

          {/* انتخاب فرمت خروجی */}
          <div className="border-t border-zinc-800/80 pt-4 space-y-2">
            <span className="block text-xs font-semibold text-zinc-400">فرمت خروجی (Output format):</span>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-2.5 text-xs text-white focus:outline-none focus:border-gold"
            >
              <option value="auto">مشابه فایل ورودی ({getResolvedInputFormat()})</option>
              <option value="mp3">MP3 (کم‌حجم و فشرده)</option>
              <option value="m4a">M4A (کیفیت بالا و فشرده)</option>
              <option value="wav">WAV (خام و بدون فشرده‌سازی)</option>
            </select>
          </div>

          {/* دکمه‌های اقدام: پیش‌نمایش و پردازش کل */}
          <div className="flex gap-3 border-t border-zinc-800/80 pt-4">
            <button
              type="button"
              onClick={handlePreview}
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 py-3 text-xs font-bold text-zinc-200 transition hover:bg-zinc-800 hover:text-white"
            >
              🎧 پیش‌نمایش (۶۰ ثانیه اول)
            </button>
            <button
              type="button"
              onClick={handleProcessFull}
              className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition"
            >
              🚀 پردازش کل فایل صوتی
            </button>
          </div>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setFile(null)
                setOriginalBuffer(null)
              }}
              className="text-[11px] text-zinc-500 hover:text-red-400"
            >
              انصراف و انتخاب فایل دیگر
            </button>
          </div>
        </div>
      )}

      {/* پلیر مقایسه و دانلود خروجی */}
      {activeBuffer && (
        <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <p className="text-sm font-bold text-white truncate max-w-xs">{file?.name}</p>
              <p className="text-xs text-gold-bright">
                {fullProcessedBuffer ? 'کل فایل پردازش شد' : 'در حال پخش پیش‌نمایش (۶۰ ثانیه)'}
              </p>
            </div>

            {/* کلید سوئیچ صدا خام / بهینه‌شده */}
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
                صدای تمیز شده ✨
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

          {/* اکشن‌های پایین پلیر */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 pt-4">
            <button
              type="button"
              onClick={() => {
                stopAudio()
                setPreviewBuffer(null)
                setFullProcessedBuffer(null)
              }}
              className="text-xs text-zinc-400 hover:text-white"
            >
              🔄 بازگشت و تغییر تنظیمات
            </button>

            <div className="flex items-center gap-2">
              {!fullProcessedBuffer && (
                <button
                  type="button"
                  onClick={handleProcessFull}
                  disabled={loading}
                  className="rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-4 py-2 text-xs font-bold text-white transition"
                >
                  ⚡ پردازش کل فایل
                </button>
              )}

              <button
                type="button"
                onClick={handleExport}
                disabled={loading}
                className="btn-primary flex items-center gap-2 px-5 py-2 text-xs font-bold shadow-lg shadow-gold/20"
              >
                <span>⬇️</span>
                <span>دانلود خروجی ({outputFormat === 'auto' ? getResolvedInputFormat() : outputFormat.toUpperCase()})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
