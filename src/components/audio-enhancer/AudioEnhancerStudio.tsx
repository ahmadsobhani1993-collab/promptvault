'use client'

import React, { useState, useRef } from 'react'
import {
  processAudioBuffer,
  bufferToStandardAudio,
  formatAudioTime,
  ProcessingOptions,
  SAMPLE_RATE,
} from './audio-utils'
import { useLocale } from '@/lib/use-locale'

export default function AudioEnhancerStudio() {
  const isEn = useLocale() === 'en'
  const [file, setFile] = useState<File | null>(null)
  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null)
  const [previewBuffer, setPreviewBuffer] = useState<AudioBuffer | null>(null)
  const [fullProcessedBuffer, setFullProcessedBuffer] = useState<AudioBuffer | null>(null)

  const [options, setOptions] = useState<ProcessingOptions>({
    attenuationLevel: 65,
    loudnessNormalization: false,
    voiceEq: false,
  })

  const [outputFormat, setOutputFormat] = useState<'mp3' | 'wav'>('mp3')
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
    setLoadingText(isEn ? 'Decoding audio...' : 'در حال دیکود فایل صوتی...')

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
      alert(isEn ? 'This file format is invalid or unsupported.' : 'فرمت فایل نامعتبر است یا پشتیبانی نمی‌شود.')
      setFile(null)
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = async () => {
    if (!originalBuffer) return
    stopAudio()
    setLoading(true)
    setProgressPercent(10)
    setLoadingText(isEn ? 'Preparing a 60-second preview...' : 'در حال آماده‌سازی پیش‌نمایش ۶۰ ثانیه‌ای...')

    try {
      const result = await processAudioBuffer(originalBuffer, options, 60, (pct, status) => {
        setProgressPercent(pct)
        setLoadingText(isEn
          ? status.replace('در حال بارگذاری ماژول رسمی DeepFilterNet3...', 'Loading the DeepFilterNet3 module...')
            .replace('در حال اتصال به فایل‌های مدل در سرور محلی...', 'Connecting to the local model files...')
            .replace('در حال دریافت هسته هوش مصنوعی...', 'Loading the AI engine...')
            .replace('در حال رندر آفلاین امواج صوتی...', 'Rendering audio offline...')
            .replace('پردازش با موفقیت انجام شد!', 'Processing completed successfully!')
          : status)
      })
      setPreviewBuffer(result)
      setFullProcessedBuffer(null)
      setPlayEnhanced(true)
      setDuration(result.duration)
      setCurrentTime(0)
      pauseOffsetRef.current = 0
    } catch (err: any) {
      alert(`${isEn ? 'Preview processing failed' : 'خطا در پردازش پیش‌نمایش'}: ${err?.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  const handleProcessFull = async () => {
    if (!originalBuffer) return
    stopAudio()
    setLoading(true)
    setProgressPercent(10)
    setLoadingText(isEn ? 'Processing the full file with DeepFilterNet3...' : 'در حال پردازش کل فایل با DeepFilterNet3...')

    try {
      const result = await processAudioBuffer(originalBuffer, options, null, (pct, status) => {
        setProgressPercent(pct)
        setLoadingText(isEn
          ? status.replace('در حال بارگذاری ماژول رسمی DeepFilterNet3...', 'Loading the DeepFilterNet3 module...')
            .replace('در حال اتصال به فایل‌های مدل در سرور محلی...', 'Connecting to the local model files...')
            .replace('در حال دریافت هسته هوش مصنوعی...', 'Loading the AI engine...')
            .replace('در حال رندر آفلاین امواج صوتی...', 'Rendering audio offline...')
            .replace('پردازش با موفقیت انجام شد!', 'Processing completed successfully!')
          : status)
      })
      setFullProcessedBuffer(result)
      setPlayEnhanced(true)
      setDuration(result.duration)
      setCurrentTime(0)
      pauseOffsetRef.current = 0
    } catch (err: any) {
      alert(`${isEn ? 'Full-file processing failed' : 'خطا در پردازش کل فایل'}: ${err?.message || err}`)
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
    setLoadingText(isEn ? `Encoding ${outputFormat.toUpperCase()} output...` : `در حال انکود خروجی ${outputFormat.toUpperCase()}...`)

    try {
      const { blob, fileName } = await bufferToStandardAudio(targetBuffer, file.name, outputFormat)
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch {
      alert(isEn ? 'Could not download the output.' : 'خطا در دانلود خروجی.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">
          {isEn ? <>Audio <span className="text-gold-bright">Enhancer Studio</span></> : <>استودیو تقویت و <span className="text-gold-bright">شفاف‌ساز صدا</span></>}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {isEn ? 'Remove noise with DeepFilterNet3, processed locally in your browser.' : 'حذف نویز با مدل هوش مصنوعی DeepFilterNet3 کاملاً محلی در مرورگر'}
        </p>
      </div>

      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center text-xs text-emerald-400">
        {isEn ? 'All processing happens locally in your browser. Your files are never uploaded.' : 'تمامی پردازش‌ها ۱۰۰٪ محلی در مرورگر شما انجام می‌شود و فایلی به هیچ سروری ارسال نمی‌شود.'}
      </div>

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
            <span className="mt-3 text-sm font-bold text-white">{isEn ? 'Choose or drop an audio file' : 'انتخاب یا رها کردن فایل صوتی'}</span>
            <span className="mt-1 text-xs text-zinc-500">{isEn ? 'Supports common audio and video formats' : 'پشتیبانی از انواع فرمت‌های صوتی و ویدیویی'}</span>
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

      {file && !activeBuffer && !loading && (
        <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl">
          <div>
            <span className="block text-xs font-semibold text-zinc-400 mb-2">{isEn ? 'Selected file:' : 'فایل صوتی انتخابی:'}</span>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
              <span className="text-sm font-bold text-white">{file.name}</span>
              <span className="block text-xs text-zinc-500 mt-1">{isEn ? 'Duration:' : 'مدت زمان:'} {formatAudioTime(duration)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-zinc-300">{isEn ? 'Noise reduction:' : 'شدت حذف نویز:'}</span>
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
              <span>{isEn ? 'Light' : 'ملایم (Light)'}</span>
              <span>{isEn ? 'Strong' : 'قوی (Heavy)'}</span>
            </div>
          </div>

          <div className="space-y-3 border-t border-zinc-800/80 pt-4">
            <span className="block text-xs font-semibold text-zinc-400">{isEn ? 'Audio enhancements (optional):' : 'بهینه‌سازی صدا (اختیاری):'}</span>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={options.loudnessNormalization}
                onChange={(e) => setOptions({ ...options, loudnessNormalization: e.target.checked })}
                className="h-4 w-4 accent-gold cursor-pointer rounded"
              />
              <div>
                <span className="block text-xs font-bold text-white">{isEn ? 'Loudness normalization' : 'نرمال‌سازی بلندی صدا (Loudness Normalization)'}</span>
                <span className="block text-[11px] text-zinc-500">{isEn ? 'Set audio levels to podcast standards' : 'تنظیم تراز صدا بر اساس استاندارد پادکست'}</span>
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
                <span className="block text-xs font-bold text-white">{isEn ? 'Voice clarity EQ' : 'اکولایزر وضوح کلام (Voice EQ)'}</span>
                <span className="block text-[11px] text-zinc-500">{isEn ? 'Reduce excess low frequencies and improve speech clarity' : 'حذف فرکانس‌های بم اضافه و افزایش شفافیت کلام'}</span>
              </div>
            </label>
          </div>

          <div className="border-t border-zinc-800/80 pt-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">{isEn ? 'Output format:' : 'فرمت خروجی نهایی:'}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOutputFormat('mp3')}
                className={`px-3 py-1 text-xs rounded-lg border transition ${
                  outputFormat === 'mp3' ? 'border-gold bg-gold/15 text-gold-bright font-bold' : 'border-zinc-800 text-zinc-400'
                }`}
              >
                MP3 {isEn ? '(smaller file)' : '(کم‌حجم)'}
              </button>
              <button
                type="button"
                onClick={() => setOutputFormat('wav')}
                className={`px-3 py-1 text-xs rounded-lg border transition ${
                  outputFormat === 'wav' ? 'border-gold bg-gold/15 text-gold-bright font-bold' : 'border-zinc-800 text-zinc-400'
                }`}
              >
                WAV {isEn ? '(uncompressed)' : '(خام و استودیویی)'}
              </button>
            </div>
          </div>

          <div className="flex gap-3 border-t border-zinc-800/80 pt-4">
            <button
              type="button"
              onClick={handlePreview}
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 py-3 text-xs font-bold text-zinc-200 transition hover:bg-zinc-800 hover:text-white"
            >
              {isEn ? '🎧 Preview (first 60 seconds)' : '🎧 پیش‌نمایش (۶۰ ثانیه اول)'}
            </button>
            <button
              type="button"
              onClick={handleProcessFull}
              className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition"
            >
              {isEn ? '🚀 Process full audio' : '🚀 پردازش کل فایل صوتی'}
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
              {isEn ? 'Cancel and choose another file' : 'انصراف و انتخاب فایل دیگر'}
            </button>
          </div>
        </div>
      )}

      {activeBuffer && (
        <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <p className="text-sm font-bold text-white truncate max-w-xs">{file?.name}</p>
              <p className="text-xs text-gold-bright">
                {fullProcessedBuffer ? (isEn ? 'Full file processed' : 'کل فایل پردازش شد') : (isEn ? 'Playing preview (60 seconds)' : 'در حال پخش پیش‌نمایش (۶۰ ثانیه)')}
              </p>
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
                {isEn ? 'Original audio' : 'صدای خام اولیه'}
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
                {isEn ? 'Enhanced audio ✨' : 'صدای تمیز شده ✨'}
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
              {isEn ? '🔄 Back to settings' : '🔄 بازگشت و تغییر تنظیمات'}
            </button>

            <div className="flex items-center gap-2">
              {!fullProcessedBuffer && (
                <button
                  type="button"
                  onClick={handleProcessFull}
                  disabled={loading}
                  className="rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-4 py-2 text-xs font-bold text-white transition"
                >
                  {isEn ? '⚡ Process full file' : '⚡ پردازش کل فایل'}
                </button>
              )}

              <button
                type="button"
                onClick={handleExport}
                disabled={loading}
                className="btn-primary flex items-center gap-2 px-5 py-2 text-xs font-bold shadow-lg shadow-gold/20"
              >
                <span>⬇️</span>
                <span>{isEn ? `Download (${outputFormat.toUpperCase()})` : `دانلود (${outputFormat.toUpperCase()})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
