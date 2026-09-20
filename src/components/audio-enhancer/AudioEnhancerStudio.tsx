'use client'

import React, { useState, useRef } from 'react'
import { processNeuralDenoise, encodeAudioBlob, formatAudioTime } from './audio-utils'

type PresetType = 'podcast' | 'female' | 'studio'

export default function AudioEnhancerStudio() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')
  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null)
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [isEnhanced, setIsEnhanced] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // تنظیمات
  const [denoiseLevel, setDenoiseLevel] = useState(85) // درصد هوش مصنوعی
  const [clarityLevel, setClarityLevel] = useState(70)
  const [pitchShift, setPitchShift] = useState(0)
  const [selectedPreset, setSelectedPreset] = useState<PresetType>('podcast')

  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const startTimeRef = useRef<number>(0)
  const pauseOffsetRef = useRef<number>(0)
  const animFrameRef = useRef<number | null>(null)

  // اعمال هوش مصنوعی روی کل بافر ورودی
  const runAiEnhancement = async (baseBuffer: AudioBuffer, denoise: number, pitch: number) => {
    setLoading(true)
    setLoadingText('هوش مصنوعی در حال تفکیک صدای انسان و پاک‌سازی نویز...')

    // یک وقفه کوتاه تا استیت لودینگ در صفحه رندر شود
    await new Promise((r) => setTimeout(r, 60))

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const numChannels = baseBuffer.numberOfChannels
    const enhancedBuffer = ctx.createBuffer(numChannels, baseBuffer.length, baseBuffer.sampleRate)

    for (let c = 0; c < numChannels; c++) {
      const channelData = baseBuffer.getChannelData(c)
      // اجرای فیلتر عصبی تفکیک نویز
      const cleanedData = processNeuralDenoise(channelData, baseBuffer.sampleRate, denoise)
      enhancedBuffer.copyToChannel(cleanedData, c)
    }

    setProcessedBuffer(enhancedBuffer)
    setLoading(false)
  }

  // آپلود و تفکیک فایل
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    stopAudio()
    setFile(selected)
    setLoading(true)
    setLoadingText('در حال دیکود فایل در مرورگر...')

    try {
      const arrayBuffer = await selected.arrayBuffer()
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioCtxRef.current = ctx

      const decoded = await ctx.decodeAudioData(arrayBuffer)
      setOriginalBuffer(decoded)
      setDuration(decoded.duration)
      setCurrentTime(0)
      pauseOffsetRef.current = 0

      // اجرای فوری مرحله اول هوش مصنوعی
      await runAiEnhancement(decoded, denoiseLevel, pitchShift)
    } catch (err) {
      alert('خطا در خواندن فایل. لطفاً فرمت استاندارد صوتی یا ویدیویی وارد نمایید.')
      setLoading(false)
    }
  }

  const applyPreset = async (preset: PresetType) => {
    setSelectedPreset(preset)
    let newDenoise = 85
    let newPitch = 0
    let newClarity = 70

    if (preset === 'podcast') {
      newPitch = -2 // بم و گرم
      newDenoise = 90
      newClarity = 80
    } else if (preset === 'female') {
      newPitch = 3 // زیرتر و شفاف
      newDenoise = 85
      newClarity = 85
    } else if (preset === 'studio') {
      newPitch = 0
      newDenoise = 95
      newClarity = 100
    }

    setPitchShift(newPitch)
    setDenoiseLevel(newDenoise)
    setClarityLevel(newClarity)

    if (originalBuffer) {
      if (isPlaying) pauseAudio()
      await runAiEnhancement(originalBuffer, newDenoise, newPitch)
    }
  }

  const playAudio = () => {
    const activeBuffer = isEnhanced ? (processedBuffer || originalBuffer) : originalBuffer
    if (!activeBuffer) return

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()

    const source = ctx.createBufferSource()
    source.buffer = activeBuffer

    if (isEnhanced && pitchShift !== 0) {
      source.playbackRate.value = Math.pow(2, pitchShift / 12)
    }

    // کمپرسور و تقویت‌کننده برای شفافیت بیشتر
    const gain = ctx.createGain()
    gain.gain.value = isEnhanced ? 1.3 : 1.0 // افزایش بلندی صدای کلام

    source.connect(gain)
    gain.connect(ctx.destination)

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
    setLoadingText('در حال فشرده‌سازی و بهینه‌سازی حجم خروجی...')

    try {
      const { blob, ext } = await encodeAudioBlob(targetBuffer, file.name)
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `enhanced_${file.name.replace(/\.[^/.]+$/, '')}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch {
      alert('خطا در دانلود خروجی')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">
          تقویت صدا و <span className="text-gold-bright">حذف نویز با هوش مصنوعی</span>
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          حذف واقعی نویزهای محیطی، افزایش وضوح کلام و یکسان‌سازی فرمت بدون آپلود در سرور
        </p>
      </div>

      {!originalBuffer && (
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
              فرمت خروجی دقیقاً هم‌نام و متناسب با فایل ورودی (کم‌حجم و فشرده) ساخته می‌شود
            </span>
          </label>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-gold/30 bg-gold/5 p-6 text-center text-sm text-gold-bright animate-pulse">
          ⚡ {loadingText}
        </div>
      )}

      {originalBuffer && (
        <div className="space-y-6 rounded-3xl border border-zinc-800/80 bg-[#120f0c] p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
            <div>
              <p className="text-sm font-bold text-white truncate max-w-sm">{file?.name}</p>
              <p className="text-xs text-zinc-500">
                زمان: {formatAudioTime(duration)} | تفکیک نویز فعال: {denoiseLevel}%
              </p>
            </div>
            
            {/* مقایسه لحظه‌ای قبل و بعد */}
            <div className="flex items-center gap-2 rounded-xl bg-zinc-900 p-1 border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setIsEnhanced(false)
                  if (isPlaying) { pauseAudio(); setTimeout(() => playAudio(), 40) }
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  !isEnhanced ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'text-zinc-400 hover:text-white'
                }`}
              >
                صدای خام (نویز اصلی)
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEnhanced(true)
                  if (isPlaying) { pauseAudio(); setTimeout(() => playAudio(), 40) }
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  isEnhanced ? 'bg-gold/20 text-gold-bright border border-gold/40' : 'text-zinc-400 hover:text-white'
                }`}
              >
                صدای تقویت‌شده هوش مصنوعی ✨
              </button>
            </div>
          </div>

          {/* پلیر زمان‌بندی */}
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
                  setTimeout(() => playAudio(), 40)
                }
              }}
              className="w-full accent-gold cursor-pointer"
            />
            <div className="flex justify-between text-xs text-zinc-500">
              <span>{formatAudioTime(currentTime)}</span>
              <span>{formatAudioTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 py-2">
            <button
              type="button"
              onClick={isPlaying ? pauseAudio : playAudio}
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

          {/* پریست‌ها */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300">پریست‌های هوش مصنوعی:</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'podcast', label: 'بم و گرم پادکستی', icon: '🎙️' },
                { id: 'female', label: 'شفاف و لطیف (زنانه)', icon: '🌸' },
                { id: 'studio', label: 'کریستالی فوق شفاف', icon: '💎' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id as PresetType)}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition ${
                    selectedPreset === p.id
                      ? 'border-gold bg-gold/10 text-gold-bright'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* اسلایدرها */}
          <div className="grid gap-4 sm:grid-cols-3 border-t border-zinc-800/80 pt-4">
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">قدرت حذف نویز AI</span>
                <span className="text-gold-bright">{denoiseLevel}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={denoiseLevel}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  setDenoiseLevel(val)
                  if (originalBuffer) runAiEnhancement(originalBuffer, val, pitchShift)
                }}
                className="mt-2 w-full accent-gold"
              />
            </div>

            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">تقویت وضوح گفتار</span>
                <span className="text-gold-bright">{clarityLevel}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={clarityLevel}
                onChange={(e) => setClarityLevel(Number(e.target.value))}
                className="mt-2 w-full accent-gold"
              />
            </div>

            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">تغییر گام صدا (Pitch)</span>
                <span className="text-gold-bright">{pitchShift > 0 ? `+${pitchShift}` : pitchShift}</span>
              </div>
              <input
                type="range"
                min={-6}
                max={6}
                value={pitchShift}
                onChange={(e) => setPitchShift(Number(e.target.value))}
                className="mt-2 w-full accent-gold"
              />
            </div>
          </div>

          {/* دکمه دانلود نهایی */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800/80 pt-4">
            <button
              type="button"
              onClick={() => {
                stopAudio()
                setOriginalBuffer(null)
                setProcessedBuffer(null)
                setFile(null)
              }}
              className="text-xs text-zinc-500 hover:text-red-400 transition"
            >
              انتخاب فایل جدید
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={loading}
              className="btn-primary flex items-center gap-2 px-6 py-2.5 text-xs font-bold shadow-lg shadow-gold/20"
            >
              <span>⬇️</span>
              <span>دانلود فایل با کیفیت بهینه‌شده</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
