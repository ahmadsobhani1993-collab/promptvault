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
  const [translating, setTranslating] = useState(false)
  const [generatingCaption, setGeneratingCaption] = useState(false)

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
    ensureFontLoaded(styleConfig.fontFamily).then(() => { if (active) setFontLoaded(true) })
    return () => { active = false }
  }, [styleConfig.fontFamily])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isMov = file.name.toLowerCase().endsWith('.mov')
    if (!file.type.startsWith('video/') && !isMov) return
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(`❌ حجم فایل (${(file.size / (1024 * 1024)).toFixed(1)}MB) بیش از حد مجاز است.`)
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
    renderStudioFrame({ ctx, canvasWidth: clamped.width, canvasHeight: clamped.height, video, currentTime: video.currentTime || currentTime, segments: segments as StudioSegment[], style: styleConfig })
  }, [currentTime, segments, styleConfig])

  useEffect(() => {
    if (!fontLoaded) return
    if (!isPlaying) { drawCurrentFrame(); return }
    let animId: number
    const loop = () => { drawCurrentFrame(); animId = requestAnimationFrame(loop) }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [isPlaying, fontLoaded, drawCurrentFrame])

  const togglePlay = () => { if (!videoRef.current) return; isPlaying ? videoRef.current.pause() : videoRef.current.play() }
  const seek = (time: number) => { if (!videoRef.current) return; videoRef.current.currentTime = time; setCurrentTime(time) }

  const handleAdjustTime = (id: string, deltaStart: number, deltaEnd: number) => {
    setSegments((prev: any[]) => prev.map((s) => s.id !== id ? s : { ...s, start: Math.max(0, s.start + deltaStart), end: Math.max(s.start + 0.2, s.end + deltaEnd) }))
  }
  const handleTextChange = (id: string, text: string) => {
    setSegments((prev: any[]) => prev.map((s) => s.id === id ? { ...s, text } : s))
  }
  const handleDeleteSeg = (id: string) => {
    setSegments((prev: any[]) => prev.filter((s) => s.id !== id))
  }

  const fmt = (t: number) => { const m = Math.floor(t / 60); const s = Math.floor(t % 60); return `${m}:${s.toString().padStart(2, '0')}` }

  const handleTranslate = async (targetLang: 'fa' | 'en') => {
    if (!segments.length || translating) return
    setTranslating(true)
    try {
      const pad = (n: number, z = 2) => String(Math.floor(n)).padStart(z, '0')
      const fmtTime = (sec: number) => { const s = Math.max(0, Number(sec) || 0); return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)},${pad((s % 1) * 1000, 3)}` }
      const srt = segments.map((s, i) => `${i + 1}\n${fmtTime(s.start)} --> ${fmtTime(s.end)}\n${s.text}`).join('\n\n')
      const res = await fetch('/api/translate-srt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ srtContent: srt, targetLang }) })
      const data = await res.json()
      if (data.srt) {
        const blocks = data.srt.trim().replace(/\r\n/g, '\n').split(/\n\s*\n/)
        const parsed = blocks.map((b: string) => { const lines = b.trim().split('\n'); return lines.length >= 3 ? lines.slice(2).join(' ').trim() : '' })
        setSegments(segments.map((seg, idx) => ({ ...seg, text: parsed[idx] || seg.text })))
      }
    } catch (e) { alert('خطا در ترجمه') }
    finally { setTranslating(false) }
  }

  const handleGenerateCaption = async () => {
    if (!segments.length || generatingCaption) return
    setGeneratingCaption(true)
    try {
      const fullText = segments.map(s => s.text).join(' ')
      const res = await fetch('/api/generate-caption', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: fullText }) })
      const data = await res.json()
      if (data.caption) {
        navigator.clipboard.writeText(data.caption + (data.hashtags ? '\n\n' + data.hashtags : ''))
        alert('✅ کپشن تولید و در کلیپ‌بورد کپی شد!')
      }
    } catch (e) { alert('خطا در تولید کپشن') }
    finally { setGeneratingCaption(false) }
  }

  if (auth === 'checking') return <div className="p-10 text-center text-sm text-white/40">در حال بررسی…</div>
  if (auth === 'no') return (
    <div className="container-app py-16" dir="rtl">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-[#12100d]/90 p-8 text-center">
        <h2 className="text-xl font-black text-white mb-3">ورود الزامی است</h2>
        <Link href="/login" className="rounded-xl bg-amber-500 px-8 py-3 text-xs font-bold text-black">ورود به حساب</Link>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col min-h-[calc(100vh-200px)]" dir="rtl">
      <video ref={videoRef} src={videoUrl} className="hidden" playsInline />
      
      {/* Toolbar استودیو (نه هدر کامل) */}
      {videoUrl && (
        <div className="border-b border-stone-800 bg-[#110f0d] px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-black text-white truncate max-w-xs">{fileName || 'استودیو زیرنویس'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowStylePanel(true)} className="px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-bold">🎨 استایل</button>
            <button onClick={() => setShowExportModal(true)} className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-1.5 text-xs font-black text-black">خروجی MP4 ⚡</button>
          </div>
        </div>
      )}

      {!videoUrl ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-3xl border border-stone-800 bg-[#12100d] p-8 text-center">
            <div className="text-4xl mb-4">🎬</div>
            <h2 className="text-lg font-black text-white mb-2">ویدیوی خود را وارد کنید</h2>
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="text-xs text-stone-400">سرعت:</span>
              {([1, 2, 4, 8] as const).map((s) => (
                <button key={s} onClick={() => setSpeed(s)} className={`rounded-lg px-2.5 py-1 text-xs font-bold ${speed === s ? 'bg-amber-500 text-black' : 'bg-stone-900 text-stone-400'}`}>{s}x</button>
              ))}
            </div>
            <label className="block w-full cursor-pointer rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-xs font-black text-black">
              انتخاب ویدیو
              <input type="file" accept="video/*,.mov,.mp4" onChange={handleFile} className="hidden" />
            </label>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* بخش ویدیو */}
          <div className="flex-1 flex flex-col bg-black items-center justify-center p-2 sm:p-4 relative overflow-hidden min-h-0">
            {busy && (
              <div className="absolute top-3 inset-x-4 max-w-md mx-auto z-20 bg-stone-900/90 border border-amber-500/40 p-3 rounded-2xl backdrop-blur-md">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-amber-400 font-bold">{status}</span>
                  <button onClick={stop} className="text-red-400 text-[10px]">توقف</button>
                </div>
                <div className="h-1.5 w-full bg-stone-800 rounded-full"><div className="h-full bg-amber-500" style={{ width: `${progress}%` }} /></div>
              </div>
            )}
            <div onClick={togglePlay} className="relative max-h-[45vh] sm:max-h-[76vh] w-full max-w-full rounded-2xl bg-black cursor-pointer border border-stone-800">
              <canvas ref={canvasRef} className="max-h-[43vh] sm:max-h-[74vh] w-auto max-w-full object-contain" />
            </div>
            <div className="w-full max-w-xl mt-2 sm:mt-3 flex items-center gap-3 bg-[#110f0d] p-2 sm:p-2.5 rounded-2xl border border-stone-800">
              <button onClick={togglePlay} className="h-9 w-9 rounded-xl bg-amber-500 text-black font-bold flex items-center justify-center">{isPlaying ? '⏸' : '▶'}</button>
              <input type="range" min={0} max={duration || 1} step={0.05} value={currentTime} onChange={(e) => seek(Number(e.target.value))} className="flex-1 accent-amber-500" />
              <span className="font-mono text-[11px] text-stone-400">{fmt(currentTime)} / {fmt(duration)}</span>
            </div>
          </div>

          {/* بخش تایم‌لاین */}
          <div className="h-[40vh] sm:h-[35vh] lg:h-auto lg:flex-1 lg:w-[400px] xl:w-[450px] flex flex-col bg-[#0e0d0b] border-t border-stone-800 overflow-hidden shrink-0">
            <div className="p-2 sm:p-3 border-b border-stone-800 flex flex-wrap items-center justify-between gap-2 bg-[#12100d] shrink-0">
              <span className="text-xs font-bold text-white">تایم‌لاین ({segments.length})</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={() => setSegments([...segments, { id: `seg_${Date.now()}`, start: currentTime, end: currentTime + 2.5, text: 'متن جدید' }])} className="px-2 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-[10px] sm:text-xs font-bold">+ افزودن</button>
                <button onClick={() => handleTranslate('fa')} disabled={translating} className="px-2 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg text-[10px] sm:text-xs font-bold disabled:opacity-50">{translating ? '...' : 'ترجمه FA'}</button>
                <button onClick={handleGenerateCaption} disabled={generatingCaption} className="px-2 py-1 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-lg text-[10px] sm:text-xs font-bold disabled:opacity-50">{generatingCaption ? '...' : 'کپشن AI'}</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2">
              {segments.length === 0 ? <div className="text-center text-stone-500 text-xs py-8">هنوز کپشنی وجود ندارد</div> : segments.map((seg: any) => {
                const isCurrent = currentTime >= seg.start && currentTime <= seg.end
                return (
                  <div key={seg.id} className={`rounded-lg border transition-all ${isCurrent ? 'bg-amber-500/10 border-amber-500/60' : 'bg-stone-900/60 border-stone-800'}`}>
                    <div className="flex items-center justify-between px-2 py-1.5 border-b border-stone-800/50">
                      <button onClick={() => seek(seg.start)} className="bg-stone-800 px-2 py-0.5 rounded text-amber-400 font-mono text-[10px]">{fmt(seg.start)} - {fmt(seg.end)}</button>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleAdjustTime(seg.id, -0.5, 0)} className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300">-0.5</button>
                        <button onClick={() => handleAdjustTime(seg.id, 0.5, 0)} className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300">+0.5</button>
                        <button onClick={() => handleDeleteSeg(seg.id)} className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[10px]">✕</button>
                      </div>
                    </div>
                    <div className="p-2">
                      <textarea rows={2} value={seg.text} onChange={(e) => handleTextChange(seg.id, e.target.value)} onClick={(e) => { e.stopPropagation(); seek(seg.start) }} className="w-full bg-black/40 border border-stone-800/80 rounded-lg p-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500/50 resize-none" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {showStylePanel && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center sm:justify-end">
              <div className="w-full sm:w-84 bg-[#12100d] border-t sm:border-t-0 sm:border-r border-stone-800 shadow-2xl max-h-[80vh] sm:max-h-full overflow-y-auto rounded-t-2xl sm:rounded-none">
                <TemplatePanel config={styleConfig} onChange={updateStyle} onClose={() => setShowStylePanel(false)} />
              </div>
            </div>
          )}
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#14120f] border border-stone-800 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-stone-800 pb-3">
              <h3 className="text-base font-bold text-white">خروجی نهایی ویدیو</h3>
              <button onClick={() => setShowExportModal(false)} className="text-stone-400 hover:text-white">✕</button>
            </div>
            <SubtitleVideoExport videoUrl={videoUrl} sourceFile={sourceFile} segments={segments as any} style={styleConfig as any} baseName={baseName} />
          </div>
        </div>
      )}
    </div>
  )
}
