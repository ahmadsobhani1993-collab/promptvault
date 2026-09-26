'use client'
import Link from 'next/link'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/use-auth'
import { useVideoTranscribe } from '@/lib/use-video-transcribe'
import { StudioSegment, StudioStyleConfig, getStoredStyle, saveStoredStyle } from '@/lib/studio/unified-style'
import { renderStudioFrame, clampCanvasDimensions } from '@/lib/studio/universal-renderer'
import { ensureFontLoaded } from '@/lib/studio/font-loader'
import TemplatePanel from '../studio/panels/TemplatePanel'
import SubtitleVideoExport from './SubtitleVideoExport'

const MAX_FILE_SIZE_MB = 250
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

export default function VideoSubtitleClient() {
  const auth = useAuth()
  const [videoUrl, setVideoUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [speed, setSpeed] = useState<1 | 2 | 4 | 8>(4)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showStylePanel, setShowStylePanel] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedSegId, setSelectedSegId] = useState<string | null>(null)

  const { status, progress, busy, segments, setSegments, run, stop } = useVideoTranscribe()
  const [styleConfig, setStyleConfig] = useState<StudioStyleConfig>(() => getStoredStyle())
  const updateStyle = (patch: Partial<StudioStyleConfig>) => {
    setStyleConfig((prev) => {
      const next = { ...prev, ...patch }
      saveStoredStyle(next)
      return next
    })
  }

  const baseName = fileName.replace(/\.[^.]+$/, '') || 'video'
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [fontLoaded, setFontLoaded] = useState(false)

  useEffect(() => {
    let active = true
    setFontLoaded(false)
    ensureFontLoaded(styleConfig.fontFamily).then(() => {
      if (active) setFontLoaded(true)
    })
    return () => { active = false }
  }, [styleConfig.fontFamily])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isMov = file.name.toLowerCase().endsWith('.mov')
    if (!file.type.startsWith('video/') && !isMov) return
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(1)
      alert(`❌ حجم فایل انتخابی (${sizeInMB} مگابایت) بیش از سقف مجاز ۲۵۰ مگابایت است.`)
      e.target.value = ''
      return
    }
    setFileName(file.name)
    setSourceFile(file)
    setVideoUrl(URL.createObjectURL(file))
    await run(file, speed)
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const handleTimeUpdate = () => setCurrentTime(video.currentTime)
    const handleLoaded = () => setDuration(video.duration || 0)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoaded)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoaded)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
    }
  }, [videoUrl])

  const drawCurrentFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let targetW = video.videoWidth || 1080
    let targetH = video.videoHeight || 1920
    if (styleConfig.aspectRatio === '9:16') { targetW = 1080; targetH = 1920 }
    else if (styleConfig.aspectRatio === '16:9') { targetW = 1920; targetH = 1080 }
    else if (styleConfig.aspectRatio === '1:1') { targetW = 1080; targetH = 1080 }
    else if (styleConfig.aspectRatio === '4:5') { targetW = 1080; targetH = 1350 }
    const clamped = clampCanvasDimensions(targetW, targetH, 1920)
    if (canvas.width !== clamped.width || canvas.height !== clamped.height) {
      canvas.width = clamped.width; canvas.height = clamped.height
    }
    renderStudioFrame({
      ctx, canvasWidth: clamped.width, canvasHeight: clamped.height,
      video, currentTime: video.currentTime || currentTime,
      segments: segments as StudioSegment[], style: styleConfig,
    })
  }, [currentTime, segments, styleConfig])

  useEffect(() => {
    if (!fontLoaded) return
    if (!isPlaying) { drawCurrentFrame(); return }
    let animId: number
    const loop = () => { drawCurrentFrame(); animId = requestAnimationFrame(loop) }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [isPlaying, fontLoaded, drawCurrentFrame])

  const togglePlay = () => {
    if (!videoRef.current) return
    isPlaying ? videoRef.current.pause() : videoRef.current.play()
  }

  const seek = (time: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = time
    setCurrentTime(time)
  }

  const handleAdjustTime = (id: string, deltaStart: number, deltaEnd: number) => {
    setSegments((prev: any[]) =>
      prev.map((s) => {
        if (s.id !== id) return s
        const newStart = Math.max(0, s.start + deltaStart)
        const newEnd = Math.max(newStart + 0.2, s.end + deltaEnd)
        return { ...s, start: newStart, end: newEnd }
      })
    )
  }

  const handleTextChange = (id: string, text: string) => {
    setSegments((prev: any[]) => prev.map((s) => (s.id === id ? { ...s, text } : s)))
  }

  const handleDeleteSeg = (id: string) => {
    setSegments((prev: any[]) => prev.filter((s) => s.id !== id))
  }

  const fmt = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (auth === 'checking')
    return <div className="p-10 text-center text-sm text-white/40">در حال بررسی…</div>
  if (auth === 'no')
    return (
      <div className="container-app py-16" dir="rtl">
        <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#12100d]/90 p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-2xl shadow-inner"></div>
          <h2 className="text-xl md:text-2xl font-black text-white mb-3">ورود به حساب کاربری الزامی است</h2>
          <p className="text-xs md:text-sm text-stone-400 leading-relaxed mb-8 max-w-md mx-auto">
            برای استفاده از استودیو زیرنویس هوشمند با هوش مصنوعی جمینای، لطفاً وارد حساب خود شوید.
          </p>
          <Link href="/login" className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold px-8 py-3 text-xs transition shadow-lg shadow-amber-500/20">
            ورود به حساب کاربری
          </Link>
        </div>
      </div>
    )

  return (
    <div className="min-h-screen bg-[#070605] text-white flex flex-col select-none" dir="rtl">
      <video ref={videoRef} src={videoUrl} className="hidden" playsInline />
      
      {/* Header */}
      <header className="h-14 border-b border-stone-800 bg-[#110f0d] px-4 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 border border-stone-800 text-stone-400 hover:text-white">✕</Link>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-black text-white truncate max-w-[140px] sm:max-w-xs">
              {fileName || 'استودیو زیرنویس هوشمند'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {videoUrl && (
            <>
              <button
                type="button"
                onClick={() => setShowStylePanel(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition"
              >
                <span>🎨</span>
                <span className="hidden sm:inline">قالب و استایل</span>
              </button>
              <button
                type="button"
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-1.5 text-xs font-black text-black shadow-lg shadow-orange-500/20 hover:from-orange-400 active:scale-95 transition"
              >
                <span>خروجی MP4</span>
                <span>⚡</span>
              </button>
            </>
          )}
        </div>
      </header>

      {!videoUrl ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full rounded-3xl border border-stone-800 bg-[#12100d] p-8 shadow-2xl">
            <div className="h-16 w-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl"></div>
            <h2 className="text-lg font-black text-white mb-2">ویدیوی خود را وارد کنید</h2>
            <p className="text-xs text-stone-400 leading-relaxed mb-6">
              فایل ویدیوی خود را انتخاب کنید تا با هوش مصنوعی جمینای ترنسکرایب و زیرنویس دقیق کلمه‌ای برای آن ساخته شود.
            </p>
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="text-[11px] text-stone-400">سرعت پردازش:</span>
              {([1, 2, 4, 8] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    speed === s ? 'bg-amber-500 text-black' : 'bg-stone-900 border border-stone-800 text-stone-400'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
            <label className="block w-full cursor-pointer rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-xs font-black text-black shadow-lg shadow-orange-500/20 active:scale-95 transition">
              انتخاب ویدیو از گوشی یا سیستم
              <input type="file" accept="video/*,.mov,.mp4" onChange={handleFile} className="hidden" />
            </label>
          </div>
        </div>
      ) : (
        /* لی‌اوت اصلی: موبایل تک‌ستونه، دسکتاپ دو ستونه */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ستون ویدیو */}
          <div className="flex-1 flex flex-col bg-black items-center justify-center p-2 sm:p-4 relative overflow-hidden min-h-0">
            {busy && (
              <div className="absolute top-3 inset-x-4 max-w-md mx-auto z-20 bg-stone-900/90 border border-amber-500/40 p-3 rounded-2xl backdrop-blur-md">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-amber-400 font-bold">{status || 'در حال ترنسکرایب با جمینای...'}</span>
                  <button onClick={stop} className="text-red-400 text-[10px] bg-red-500/10 px-2 py-0.5 rounded">توقف</button>
                </div>
                <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            
            <div
              onClick={togglePlay}
              className="relative flex items-center justify-center max-h-[45vh] sm:max-h-[76vh] w-full max-w-full overflow-hidden rounded-2xl shadow-2xl bg-black cursor-pointer border border-stone-800"
            >
              <canvas ref={canvasRef} className="max-h-[43vh] sm:max-h-[74vh] w-auto max-w-full object-contain pointer-events-auto" />
            </div>
            
            {/* کنترلر پلیر */}
            <div className="w-full max-w-xl mt-2 sm:mt-3 flex items-center gap-3 bg-[#110f0d] p-2 sm:p-2.5 rounded-2xl border border-stone-800">
              <button
                type="button"
                onClick={togglePlay}
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-amber-500 text-black flex items-center justify-center font-bold text-xs shrink-0"
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.05}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                className="flex-1 accent-amber-500 cursor-pointer"
              />
              <span className="font-mono text-[10px] sm:text-[11px] text-stone-400 shrink-0">
                {fmt(currentTime)} / {fmt(duration)}
              </span>
            </div>
          </div>

          {/* TIMELINE - در موبایل زیر ویدیو، در دسکتاپ کنار ویدیو */}
          <div className="h-[35vh] sm:h-[30vh] lg:h-auto lg:flex-1 lg:w-[400px] xl:w-[450px] flex flex-col bg-[#0e0d0b] border-t border-stone-800 overflow-hidden shrink-0">
            {/* هدر Timeline */}
            <div className="p-2 sm:p-3 border-b border-stone-800 flex items-center justify-between bg-[#12100d] shrink-0">
              <span className="text-xs font-bold text-white">تایم‌لاین ({segments.length})</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const newSeg: StudioSegment = {
                      id: `seg_${Date.now()}`,
                      start: currentTime,
                      end: currentTime + 2.5,
                      text: 'متن جدید',
                    }
                    setSegments((prev: any[]) => [...prev, newSeg])
                  }}
                  className="px-2 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-bold hover:bg-amber-500/20"
                >
                  + افزودن
                </button>
              </div>
            </div>

            {/* محتوای Timeline - اسکرول‌پذیر */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 sm:space-y-2">
              {segments.length === 0 ? (
                <div className="text-center text-stone-500 text-xs py-8">
                  هنوز کپشنی وجود ندارد
                </div>
              ) : (
                segments.map((seg: any) => {
                  const isCurrent = currentTime >= seg.start && currentTime <= seg.end
                  return (
                    <div
                      key={seg.id}
                      className={`rounded-lg border transition-all ${
                        isCurrent
                          ? 'bg-amber-500/10 border-amber-500/60 shadow-lg'
                          : 'bg-stone-900/60 border-stone-800 hover:border-stone-700'
                      }`}
                    >
                      {/* ردیف زمان و دکمه‌ها */}
                      <div className="flex items-center justify-between px-2 py-1.5 border-b border-stone-800/50">
                        <button
                          type="button"
                          onClick={() => seek(seg.start)}
                          className="bg-stone-800 px-2 py-0.5 rounded text-amber-400 font-mono text-[10px] hover:bg-stone-700"
                        >
                          {fmt(seg.start)} - {fmt(seg.end)}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAdjustTime(seg.id, -0.5, 0)}
                            className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300"
                          >
                            -0.5
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustTime(seg.id, 0.5, 0)}
                            className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300"
                          >
                            +0.5
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSeg(seg.id)}
                            className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* ادیت متن inline */}
                      <div className="p-2">
                        <textarea
                          rows={2}
                          value={seg.text}
                          onChange={(e) => handleTextChange(seg.id, e.target.value)}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedSegId(seg.id)
                            seek(seg.start)
                          }}
                          placeholder="متن زیرنویس را اینجا بنویسید..."
                          className="w-full bg-black/40 border border-stone-800/80 rounded-lg p-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500/50 resize-none"
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* پنل استایل (کشویی) */}
          {showStylePanel && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center sm:justify-end">
              <div className="w-full sm:w-84 bg-[#12100d] border-t sm:border-t-0 sm:border-r border-stone-800 shadow-2xl max-h-[80vh] sm:max-h-full overflow-y-auto rounded-t-2xl sm:rounded-none">
                <TemplatePanel
                  config={styleConfig}
                  onChange={updateStyle}
                  onClose={() => setShowStylePanel(false)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* مودال خروجی */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#14120f] border border-stone-800 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-stone-800 pb-3">
              <h3 className="text-base font-bold text-white">خروجی نهایی ویدیو</h3>
              <button type="button" onClick={() => setShowExportModal(false)} className="text-stone-400 hover:text-white">✕</button>
            </div>
            <SubtitleVideoExport
              videoUrl={videoUrl}
              sourceFile={sourceFile}
              segments={segments as any}
              style={styleConfig as any}
              baseName={baseName}
            />
          </div>
        </div>
      )}
    </div>
  )
}
