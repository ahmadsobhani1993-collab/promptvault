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
    noiseReductionIntensity: 'balanced',
  })

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
    setProcessedBuffer(null)
    setLoading(true)
    setProgressPercent(0)
    setLoadingText('در حال دیکود فایل صوتی در مرورگر...')

    try {
      const arrayBuffer = await selected.arrayBuffer()
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 })
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

  const handleStartProcessing = async () => {
    if (!originalBuffer) return
    stopAudio()
    setLoading(true)
    setProgressPercent(5)
    setLoadingText('در حال آماده‌سازی...')

    try {
      const result = await processAudioBuffer(originalBuffer, options, (pct, status) => {
        setProgressPercent(pct)
        setLoadingText(status)
      })
      setProcessedBuffer(result)
      setPlayEnhanced(true)
      setDuration(result.duration)
      setCurrentTime(0)
      pauseOffsetRef.current = 0
    } catch (err: any) {
      alert(`خطا در پردازش با مدل: ${err?.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  const playAudio = (useEnhanced = playEnhanced) => {
    const targetBuffer = useEnhanced ? (processedBuffer || originalBuffer) : originalBuffer
    if (!targetBuffer) return

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 })
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
    const targetBuffer = processedBuffer || originalBuffer
    if (!targetBuffer || !file) return

    setLoading(true)
    setLoadingText('در حال آماده‌سازی و فشرده‌سازی خروجی نهایی...')

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
      alert('خطا در دانلود فایل.')
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
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">
          استودیو تقویت و <span className="text-gold-bright">شفاف‌ساز صدا</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          مجهز به هوش مصنوعی DeepFilterNet3 جهت تفکیک کلام و حذف نویزهای محیطی در مرورگر
        </p>
      </div>

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
              پردازش ۱۰۰٪ محلی در مرورگر شما بدون آپلود به سرور
            </span>
          </label>
        </div>
      )}

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

      {file && !processedBuffer && !loading && (
        <div className="space-y-6 rounded-3xl border border-zinc-800 bg-[#120f0c] p-6 shadow-2xl">
          <div className="border-b border-zinc-800 pb-3">
            <p className="text-sm font-bold text-white truncate">فایل: {file.name}</p>
            <p className="text-xs text-zinc-500">مدت زمان: {formatAudioTime(duration)}</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gold-bright">تنظیمات پردازش هوش مصنوعی:</h3>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="block text-sm font-bold text-white">تفکیک صدا با DeepFilterNet3</span>
                  <span className="block text-xs text-zinc-400">حذف نویز مداوم فن، باد، ترافیک و کولر حتی در زمان ادای کلمات</span>
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
                      {lvl === 'mild' ? 'ملایم (۵۰٪)' : lvl === 'balanced' ? 'متعادل (۸۰٪)' : 'قوی (۱۰۰٪)'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 cursor-pointer">
              <div>
                <span className="block text-sm font-bold text-white">افزایش حجم هوشمند (Loudness Normalizer)</span>
                <span className="block text-xs text-zinc-400">تنظیم داینامیک بلندی صدا بر پایه استانداردهای گفتار و پادکست</span>
              </div>
              <input
                type="checkbox"
                checked={options.boostVolume}
                onChange={(e) => setOptions({ ...options, boostVolume: e.target.checked })}
                className="h-5 w-5 accent-gold cursor-pointer"
              />
            </label>
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
              🚀 شروع پردازش هوش مصنوعی
            </button>
          </div>
        </div>
      )}

      {processedBuffer && (
        <div className="space-y-6 rounded-3xl border border-zinc-800 bg-[#120f0c] p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <p className="text-sm font-bold text-white truncate max-w-xs">{file?.name}</p>
              <p className="text-xs text-zinc-500">پردازش با استاندارد DeepFilterNet3 پایان یافت</p>
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
                صدای تمیز DeepFilterNet ✨
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
