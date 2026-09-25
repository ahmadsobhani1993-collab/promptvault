'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  StudioSegment,
  StudioStyleConfig,
  getStoredStyle,
  saveStoredStyle,
} from '@/lib/studio/unified-style'
import { renderStudioFrame, clampCanvasDimensions } from '@/lib/studio/universal-renderer'
import { ensureFontLoaded } from '@/lib/studio/font-loader'
import TemplatePanel from './panels/TemplatePanel'
import SubtitleVideoExport from '@/components/transcribe/SubtitleVideoExport'

interface Props {
  videoUrl: string
  initialSubtitles?: { id?: string; start: number; end: number; text: string; words?: any[] }[]
  onClose: () => void
}

export default function ComprehensiveStudio({
  videoUrl,
  initialSubtitles = [],
  onClose,
}: Props) {
  const [segments, setSegments] = useState<StudioSegment[]>(() => {
    return initialSubtitles.map((s, idx) => ({
      id: s.id || `seg_${idx}`,
      start: s.start,
      end: s.end,
      text: s.text,
      words: s.words && s.words.length > 0 ? s.words : undefined,
    }))
  })

  const [styleConfig, setStyleConfig] = useState<StudioStyleConfig>(() => getStoredStyle())

  const updateStyle = (patch: Partial<StudioStyleConfig>) => {
    setStyleConfig((prev) => {
      const next = { ...prev, ...patch }
      saveStoredStyle(next)
      return next
    })
  }

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showStylePanel, setShowStylePanel] = useState(false)
  const [selectedSegId, setSelectedSegId] = useState<string | null>(segments[0]?.id || null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [fontLoaded, setFontLoaded] = useState(false)

  // بارگذاری تضمینی فونت
  useEffect(() => {
    let active = true
    setFontLoaded(false)
    ensureFontLoaded(styleConfig.fontFamily).then(() => {
      if (active) setFontLoaded(true)
    })
    return () => { active = false }
  }, [styleConfig.fontFamily])

  // لیسنرهای ویدیو
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

  // رندر فریم زنده روی بوم داخلی
  const drawCurrentFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let targetW = video.videoWidth || 1080
    let targetH = video.videoHeight || 1920

    if (styleConfig.aspectRatio === '9:16') {
      targetW = 1080
      targetH = 1920
    } else if (styleConfig.aspectRatio === '16:9') {
      targetW = 1920
      targetH = 1080
    } else if (styleConfig.aspectRatio === '1:1') {
      targetW = 1080
      targetH = 1080
    } else if (styleConfig.aspectRatio === '4:5') {
      targetW = 1080
      targetH = 1350
    }

    const clamped = clampCanvasDimensions(targetW, targetH, 1920)
    if (canvas.width !== clamped.width || canvas.height !== clamped.height) {
      canvas.width = clamped.width
      canvas.height = clamped.height
    }

    renderStudioFrame({
      ctx,
      canvasWidth: clamped.width,
      canvasHeight: clamped.height,
      video,
      currentTime: video.currentTime || currentTime,
      segments,
      style: styleConfig,
    })
  }, [currentTime, segments, styleConfig])

  // لوپ فریم‌ها بدون مصرف CPU در زمان Pause
  useEffect(() => {
    if (!fontLoaded) return

    if (!isPlaying) {
      drawCurrentFrame()
      return
    }

    let animId: number
    const loop = () => {
      drawCurrentFrame()
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [isPlaying, fontLoaded, drawCurrentFrame])

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) videoRef.current.pause()
    else videoRef.current.play()
  }

  const seek = (time: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = time
    setCurrentTime(time)
  }

  const handleAdjustTime = (id: string, deltaStart: number, deltaEnd: number) => {
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        const newStart = Math.max(0, s.start + deltaStart)
        const newEnd = Math.max(newStart + 0.2, s.end + deltaEnd)
        return { ...s, start: newStart, end: newEnd }
      })
    )
  }

  const handleTextChange = (id: string, text: string) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)))
  }

  const handleDeleteSeg = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#0a0908] text-white overflow-hidden select-none" dir="rtl">
      <video ref={videoRef} src={videoUrl} className="hidden" playsInline />

      {/* هدر بالایی */}
      <header className="flex h-14 items-center justify-between border-b border-stone-800 bg-[#110f0d] px-5 z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 border border-stone-800 text-stone-400 hover:text-white"
          >
            ✕
          </button>
          <span className="text-sm font-black text-white">استودیوی پیشرفته زیرنویس</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowStylePanel((v) => !v)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold transition ${
              showStylePanel
                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                : 'bg-stone-900 border-stone-800 text-stone-300 hover:border-stone-700'
            }`}
          >
            <span>🎨</span>
            <span>تنظیمات استایل و قالب</span>
          </button>

          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2 text-xs font-black text-black shadow-lg shadow-orange-500/25 hover:from-orange-400 hover:to-amber-400 active:scale-95 transition"
          >
            <span>خروجی نهایی</span>
            <span>⚡</span>
          </button>
        </div>
      </header>

      {/* بدنه دو ستونه بدون وابستگی خارجی */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ستون راست: کانواس زنده درون‌برنامه‌ای */}
        <div className="flex-1 flex flex-col border-l border-stone-800 bg-black relative p-4 items-center justify-center">
          <div
            onClick={togglePlay}
            className="relative flex items-center justify-center max-h-[80vh] max-w-full overflow-hidden rounded-2xl shadow-2xl bg-black cursor-pointer border border-stone-800"
          >
            <canvas
              ref={canvasRef}
              className="max-h-[78vh] w-auto max-w-full object-contain pointer-events-auto"
            />
          </div>

          {/* پلیر */}
          <div className="w-full max-w-2xl mt-4 flex items-center gap-3 bg-[#110f0d] p-2.5 rounded-2xl border border-stone-800">
            <button
              type="button"
              onClick={togglePlay}
              className="h-9 w-9 rounded-xl bg-amber-500 text-black flex items-center justify-center font-bold text-xs"
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
            <span className="font-mono text-xs text-stone-400">
              {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
            </span>
          </div>
        </div>

        {/* ستون چپ: مدیریت سگمنت‌ها */}
        <div className="w-[420px] flex flex-col bg-[#0e0d0b] border-r border-stone-800 overflow-hidden">
          <div className="p-3 border-b border-stone-800 flex items-center justify-between bg-[#12100d]">
            <span className="text-xs font-bold text-white">کپشن‌ها ({segments.length})</span>
            <button
              type="button"
              onClick={() => {
                const newSeg: StudioSegment = {
                  id: `seg_${Date.now()}`,
                  start: currentTime,
                  end: currentTime + 2.5,
                  text: 'متن جدید زیرنویس',
                }
                setSegments((prev) => [...prev, newSeg])
              }}
              className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-bold hover:bg-amber-500/20"
            >
              + افزودن کپشن
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
            {segments.map((seg) => {
              const isCurrent = currentTime >= seg.start && currentTime <= seg.end
              return (
                <div
                  key={seg.id}
                  onClick={() => {
                    setSelectedSegId(seg.id)
                    seek(seg.start)
                  }}
                  className={`p-3 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'bg-amber-500/10 border-amber-500/60 shadow-lg'
                      : 'bg-stone-900/60 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="bg-stone-800 px-2 py-0.5 rounded-md text-amber-400 font-mono text-[11px]">
                      {seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleAdjustTime(seg.id, -0.5, 0) }}
                        className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300"
                      >
                        0.5-
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleAdjustTime(seg.id, 0.5, 0) }}
                        className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300"
                      >
                        0.5+
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteSeg(seg.id) }}
                        className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[10px] ml-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={seg.text}
                    onChange={(e) => handleTextChange(seg.id, e.target.value)}
                    className="w-full bg-black/40 border border-stone-800/80 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-amber-500/50 resize-none"
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* پنل کشویی استایل */}
        {showStylePanel && (
          <div className="absolute left-0 top-0 bottom-0 w-84 bg-[#12100d] border-r border-stone-800 shadow-2xl z-30 overflow-y-auto">
            <TemplatePanel
              config={styleConfig}
              onChange={updateStyle}
              onClose={() => setShowStylePanel(false)}
            />
          </div>
        )}
      </div>

      {/* مودال خروجی */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#14120f] border border-stone-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-stone-800 pb-3">
              <h3 className="text-base font-bold text-white">خروجی نهایی ویدیو</h3>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="text-stone-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <SubtitleVideoExport
              videoUrl={videoUrl}
              segments={segments}
              styleConfig={styleConfig}
            />
          </div>
        </div>
      )}
    </div>
  )
}
