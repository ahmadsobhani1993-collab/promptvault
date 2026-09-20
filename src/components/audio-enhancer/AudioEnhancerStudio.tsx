'use client'

import React, { useState, useRef, useEffect } from 'react'
import { audioBufferToWav, formatAudioTime } from './audio-utils'

type PresetType = 'natural' | 'podcast-warmth' | 'female-tone' | 'studio-crisp'

export default function AudioEnhancerStudio() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  
  // تنظیمات پردازش
  const [isEnhanced, setIsEnhanced] = useState(true)
  const [denoiseLevel, setDenoiseLevel] = useState(80) // 0 to 100
  const [clarityLevel, setClarityLevel] = useState(60) // 0 to 100
  const [selectedPreset, setSelectedPreset] = useState<PresetType>('natural')
  const [pitchShift, setPitchShift] = useState(0) // -12 to +12 semitones

  // نودهای وب آدیو
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const lowFilterRef = useRef<BiquadFilterNode | null>(null)
  const midFilterRef = useRef<BiquadFilterNode | null>(null)
  const highFilterRef = useRef<BiquadFilterNode | null>(null)
  
  const startTimeRef = useRef<number>(0)
  const pauseOffsetRef = useRef<number>(0)
  const animFrameRef = useRef<number | null>(null)

  // اعمال پریست‌ها روی اسلایدرها
  const applyPreset = (preset: PresetType) => {
    setSelectedPreset(preset)
    if (preset === 'natural') {
      setPitchShift(0)
      setClarityLevel(50)
      setDenoiseLevel(75)
    } else if (preset === 'podcast-warmth') {
      setPitchShift(-2) // بم‌تر شدن صدا
      setClarityLevel(70)
      setDenoiseLevel(85)
    } else if (preset === 'female-tone') {
      setPitchShift(3) // زیرتر شدن صدا
      setClarityLevel(80)
      setDenoiseLevel(80)
    } else if (preset === 'studio-crisp') {
      setPitchShift(0)
      setClarityLevel(100) // شفافیت کریستالی
      setDenoiseLevel(90)
    }
  }

  // بارگذاری و دیکود فایل در مرورگر
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    stopAudio()
    setFile(selected)
    setLoading(true)
    setLoadingText('در حال استخراج و تحلیل امواج صوتی در مرورگر...')

    try {
      const arrayBuffer = await selected.arrayBuffer()
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioCtxRef.current = ctx

      const decoded = await ctx.decodeAudioData(arrayBuffer)
      setAudioBuffer(decoded)
      setDuration(decoded.duration)
      setCurrentTime(0)
      pauseOffsetRef.current = 0
    } catch (err) {
      alert('خطا در خواندن فایل صوتی یا ویدیویی. لطفاً فرمت استاندارد انتخاب کنید.')
    } finally {
      setLoading(false)
    }
  }

  // راه‌اندازی زنجیره پردازش فیلترها
  const setupAudioGraph = () => {
    if (!audioCtxRef.current || !audioBuffer) return null

    const ctx = audioCtxRef.current
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer

    // کنترل گام و سرعت پخش در وب آدیو
    if (isEnhanced && pitchShift !== 0) {
      source.playbackRate.value = Math.pow(2, pitchShift / 12)
    } else {
      source.playbackRate.value = 1.0
    }

    const gain = ctx.createGain()
    gainNodeRef.current = gain

    if (isEnhanced) {
      // فیلتر حذف نویز فرکانس‌های زیرین (Highpass برای حذف هووم و باد)
      const highpass = ctx.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.value = denoiseLevel > 50 ? 110 : 70

      // فیلتر بم و حجم پادکستی (Lowshelf)
      const lowShelf = ctx.createBiquadFilter()
      lowShelf.type = 'lowshelf'
      lowShelf.frequency.value = 220
      lowShelf.gain.value = selectedPreset === 'podcast-warmth' ? 6 : 1
      lowFilterRef.current = lowShelf

      // فیلتر شفافیت کلام و De-esser (Highshelf)
      const highShelf = ctx.createBiquadFilter()
      highShelf.type = 'highshelf'
      highShelf.frequency.value = 4500
      highShelf.gain.value = (clarityLevel / 100) * 8
      highFilterRef.current = highShelf

      // اتصال نودها
      source.connect(highpass)
      highpass.connect(lowShelf)
      lowShelf.connect(highShelf)
      highShelf.connect(gain)
    } else {
      // حالت صدای خام (Original Bypass)
      source.connect(gain)
    }

    gain.connect(ctx.destination)
    sourceNodeRef.current = source

    return source
  }

  const playAudio = () => {
    if (!audioBuffer) return

    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume()
    }

    const source = setupAudioGraph()
    if (!source || !audioCtxRef.current) return

    const offset = pauseOffsetRef.current
    source.start(0, offset)
    startTimeRef.current = audioCtxRef.current.currentTime - offset
    setIsPlaying(true)

    const updateTick = () => {
      if (!audioCtxRef.current) return
      const cur = audioCtxRef.current.currentTime - startTimeRef.current
      if (cur >= duration) {
        stopAudio()
      } else {
        setCurrentTime(cur)
        animFrameRef.current = requestAnimationFrame(updateTick)
      }
    }
    animFrameRef.current = requestAnimationFrame(updateTick)
  }

  const pauseAudio = () => {
    if (!sourceNodeRef.current || !audioCtxRef.current) return
    sourceNodeRef.current.stop()
    sourceNodeRef.current.disconnect()
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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = Number(e.target.value)
    pauseOffsetRef.current = target
    setCurrentTime(target)
    if (isPlaying) {
      pauseAudio()
      setTimeout(() => playAudio(), 50)
    }
  }

  // دانلود نسخه نهایی بهینه‌شده
  const handleExport = async () => {
    if (!audioBuffer) return
    setLoading(true)
    setLoadingText('در حال رندر نهایی و ساخت فایل WAV بهینه‌شده...')

    try {
      // رندر آفلاین سریع تمام تغییرات با OfflineAudioContext
      const offlineCtx = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      )

      const source = offlineCtx.createBufferSource()
      source.buffer = audioBuffer
      if (pitchShift !== 0) {
        source.playbackRate.value = Math.pow(2, pitchShift / 12)
      }

      const highpass = offlineCtx.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.value = denoiseLevel > 50 ? 110 : 70

      const lowShelf = offlineCtx.createBiquadFilter()
      lowShelf.type = 'lowshelf'
      lowShelf.frequency.value = 220
      lowShelf.gain.value = selectedPreset === 'podcast-warmth' ? 6 : 1

      const highShelf = offlineCtx.createBiquadFilter()
      highShelf.type = 'highshelf'
      highShelf.frequency.value = 4500
      highShelf.gain.value = (clarityLevel / 100) * 8

      source.connect(highpass)
      highpass.connect(lowShelf)
      lowShelf.connect(highShelf)
      highShelf.connect(offlineCtx.destination)

      source.start()
      const renderedBuffer = await offlineCtx.startRendering()
      const wavBlob = audioBufferToWav(renderedBuffer)

      const downloadUrl = URL.createObjectURL(wavBlob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `enhanced_${file?.name.replace(/\.[^/.]+$/, '') || 'audio'}.wav`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      alert('خطا در ذخیره‌سازی فایل صوتی')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* سربرگ */}
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">
          استودیو تقویت و <span className="text-gold-bright">شفاف‌ساز صدا</span>
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          حذف خودکار نویزهای اضافه محیط، افزایش وضوح کلام و تغییر تن صدا به‌صورت ۱۰۰٪ محلی و امن روی مرورگر
        </p>
      </div>

      {/* باکس آپلود فایل */}
      {!audioBuffer && (
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
              انتخاب یا رها کردن فایل صوتی یا ویدیویی
            </span>
            <span className="mt-1 text-xs text-zinc-500">
              پشتیبانی از انواع فرمت‌های MP3، MP4، WAV، M4A، AAC بدون آپلود به سرور
            </span>
          </label>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-gold/30 bg-gold/5 p-6 text-center text-sm text-gold-bright animate-pulse">
          ⏳ {loadingText}
        </div>
      )}

      {/* محیط استودیو و اسلایدرها */}
      {audioBuffer && (
        <div className="space-y-6 rounded-3xl border border-zinc-800/80 bg-[#120f0c] p-6 shadow-2xl backdrop-blur-xl">
          {/* مشخصات فایل و پلیر زمان‌بندی */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
            <div>
              <p className="text-sm font-bold text-white truncate max-w-sm">{file?.name}</p>
              <p className="text-xs text-zinc-500">
                مدت زمان: {formatAudioTime(duration)} | نرخ نمونه‌برداری: {audioBuffer.sampleRate}Hz
              </p>
            </div>
            
            {/* دکمه سوییچ قبل و بعد A/B Test */}
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
                صدای خام (Original)
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
                صدای تقویت‌شده (Enhanced) ✨
              </button>
            </div>
          </div>

          {/* نوار پیشرفت پخش */}
          <div className="space-y-2">
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full accent-gold cursor-pointer"
            />
            <div className="flex justify-between text-xs text-zinc-500">
              <span>{formatAudioTime(currentTime)}</span>
              <span>{formatAudioTime(duration)}</span>
            </div>
          </div>

          {/* دکمه‌های کنترل پخش */}
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

          {/* پریست‌های آماده تن صدا */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300">انتخاب حالت پردازش صدا:</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { id: 'natural', label: 'طبیعی و شفاف', icon: '🌿' },
                { id: 'podcast-warmth', label: 'بم پادکستی (Deep)', icon: '🎙️' },
                { id: 'female-tone', label: 'لطیف و زیر (Female)', icon: '🌸' },
                { id: 'studio-crisp', label: 'کریستالی استودیو', icon: '💎' },
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

          {/* اسلایدرهای کنترلی پیشرفته */}
          <div className="grid gap-4 sm:grid-cols-3 border-t border-zinc-800/80 pt-4">
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">شدت کاهش نویز</span>
                <span className="text-gold-bright">{denoiseLevel}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={denoiseLevel}
                onChange={(e) => setDenoiseLevel(Number(e.target.value))}
                className="mt-2 w-full accent-gold"
              />
            </div>

            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">وضوح و شفافیت کلام</span>
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
                <span className="text-zinc-300">تغییر گام (Pitch Shift)</span>
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

          {/* دکمه‌های عملیاتی پایانی */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800/80 pt-4">
            <button
              type="button"
              onClick={() => {
                stopAudio()
                setAudioBuffer(null)
                setFile(null)
              }}
              className="text-xs text-zinc-500 hover:text-red-400 transition"
            >
              انصراف و انتخاب فایل دیگر
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={loading}
              className="btn-primary flex items-center gap-2 px-6 py-2.5 text-xs font-bold shadow-lg shadow-gold/20"
            >
              <span>⬇️</span>
              <span>دانلود خروجی بهینه‌شده (WAV)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
