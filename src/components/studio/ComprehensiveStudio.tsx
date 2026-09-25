'use client'

import React, { useState, useRef, useEffect } from 'react'
import { CaptionSegment, StyleConfig, DenoiseSettings } from '@/lib/studio/types'
import StudioHeader from './StudioHeader'
import StudioToolbar, { ActiveTool } from './StudioToolbar'
import StudioPreview from './StudioPreview'
import StudioTimeline from './StudioTimeline'
import CanvasPanel from './panels/CanvasPanel'
import DenoisePanel from './panels/DenoisePanel'
import TemplatePanel from './panels/TemplatePanel'
import PreparePostPanel from './panels/PreparePostPanel'
import { AudioEngine } from '@/lib/studio/audio-engine'
import { translateCaptionSegments } from '@/lib/studio/translate-service'
import SubtitleVideoExport from '@/components/transcribe/SubtitleVideoExport'

interface Props {
  videoUrl: string
  initialSubtitles?: { id?: string; start: number; end: number; text: string }[]
  onClose: () => void
}

const DEFAULT_STYLE: StyleConfig = {
  fontFamily: 'Vazirmatn',
  fontSize: 22,
  fontWeight: 'bold',
  italic: false,
  underline: false,
  textColor: '#ffffff',
  hasBg: true,
  bgColor: 'rgba(0,0,0,0.65)',
  bgRadius: 12,
  hasShadow: true,
  shadowColor: 'rgba(0,0,0,0.8)',
  shadowBlur: 8,
  shadowX: 0,
  shadowY: 2,
  hasBgShadow: false,
  activeWordColor: '#f59e0b',
  activeWordBgColor: 'rgba(245,158,11,0.25)',
  hasActiveWordBg: false,
  alignment: 'center',
  aspectRatio: '9:16',
  contentFit: 'fill',
  templateId: 'pop-classic-gold',
  showProgressBar: false,
  progressColor: '#f59e0b',
  showWaveform: false,
  waveformColor: '#38bdf8',
}

export default function ComprehensiveStudio({
  videoUrl,
  initialSubtitles = [],
  onClose,
}: Props) {
  const [segments, setSegments] = useState<CaptionSegment[]>(() => {
    return initialSubtitles.map((s, idx) => ({
      id: s.id || `seg_${idx}`,
      start: s.start,
      end: s.end,
      text: s.text,
      words: s.text.split(/\s+/).map((w, wIdx, arr) => {
        const step = (s.end - s.start) / Math.max(arr.length, 1)
        return {
          text: w,
          start: s.start + wIdx * step,
          end: s.start + (wIdx + 1) * step,
        }
      }),
    }))
  })

  const [styleConfig, setStyleConfig] = useState<StyleConfig>(DEFAULT_STYLE)
  const [activeTool, setActiveTool] = useState<ActiveTool>('none')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)

  // Undo / Redo
  const [history, setHistory] = useState<CaptionSegment[][]>([])
  const [redoStack, setRedoStack] = useState<CaptionSegment[][]>([])

  // موتور صوتی
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioEngineRef = useRef<AudioEngine>(new AudioEngine())
  const [denoiseSettings, setDenoiseSettings] = useState<DenoiseSettings>({
    enabled: false,
    intensity: 40,
    volume: 100,
  })

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

    // پیوند فیلتر صوتی به ویدیو
    try {
      audioEngineRef.current.init(video)
    } catch {}

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoaded)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
    }
  }, [videoUrl])

  useEffect(() => {
    audioEngineRef.current.applySettings(denoiseSettings)
  }, [denoiseSettings])

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

  const pushToHistory = (newSegments: CaptionSegment[]) => {
    setHistory((prev) => [...prev, segments])
    setRedoStack([])
    setSegments(newSegments)
  }

  const handleUndo = () => {
    if (!history.length) return
    const prev = history[history.length - 1]
    setRedoStack((r) => [segments, ...r])
    setHistory((h) => h.slice(0, h.length - 1))
    setSegments(prev)
  }

  const handleRedo = () => {
    if (!redoStack.length) return
    const next = redoStack[0]
    setHistory((h) => [...h, segments])
    setRedoStack((r) => r.slice(1))
    setSegments(next)
  }

  const handleTranslate = async () => {
    const translated = await translateCaptionSegments(segments, 'en')
    pushToHistory(
      translated.map((t) => ({
        ...t,
        text: t.translatedText || t.text,
      }))
    )
  }

  const currentSegment = segments.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  ) || segments.find((s) => s.id === selectedSegmentId) || null

  return (
    <div className="relative flex flex-col h-screen w-screen bg-[#070605] overflow-hidden select-none">
      {/* ۱. هدر */}
      <StudioHeader
        onClose={onClose}
        onExportClick={() => setShowExportModal(true)}
        onTranslateClick={handleTranslate}
        segments={segments}
        onImportSRT={(newSegs) => pushToHistory(newSegs)}
      />

      {/* ۲. بخش میانی: تولبار سمت چپ + پیش‌نمایش زنده + پنل کشویی ابزارها */}
      <div className="relative flex flex-1 overflow-hidden">
        <StudioToolbar activeTool={activeTool} setActiveTool={setActiveTool} />

        <StudioPreview
          videoUrl={videoUrl}
          currentTime={currentTime}
          styleConfig={styleConfig}
          currentSegment={currentSegment}
          videoRef={videoRef}
          onVideoClick={togglePlay}
        />

        {/* پنل بازشو ابزارها */}
        {activeTool !== 'none' && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-[#12100d] border-l border-stone-800 shadow-2xl z-30 overflow-y-auto">
            {activeTool === 'canvas' && (
              <CanvasPanel
                config={styleConfig}
                onChange={(patch) => setStyleConfig((s) => ({ ...s, ...patch }))}
                onClose={() => setActiveTool('none')}
              />
            )}
            {activeTool === 'ai_denoise' && (
              <DenoisePanel
                settings={denoiseSettings}
                onChange={(patch) => setDenoiseSettings((d) => ({ ...d, ...patch }))}
                onClose={() => setActiveTool('none')}
              />
            )}
            {activeTool === 'style' && (
              <TemplatePanel
                config={styleConfig}
                onChange={(patch) => setStyleConfig((s) => ({ ...s, ...patch }))}
                onClose={() => setActiveTool('none')}
              />
            )}
            {activeTool === 'prepare_post' && (
              <PreparePostPanel
                segments={segments}
                onClose={() => setActiveTool('none')}
              />
            )}
          </div>
        )}
      </div>

      {/* ۳. تایم‌لاین پایینی */}
      <StudioTimeline
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onSeek={seek}
        segments={segments}
        selectedSegmentId={selectedSegmentId}
        onSelectSegment={setSelectedSegmentId}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.length > 0}
        canRedo={redoStack.length > 0}
      />

      {/* ۴. مودال خروجی نهایی */}
      {showExportModal && (
        <div className="absolute inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#14120f] border border-stone-800 p-6 shadow-2xl text-right" dir="rtl">
            <div className="flex items-center justify-between mb-4 border-b border-stone-800 pb-3">
              <h3 className="text-base font-bold text-white">دریافت خروجی ویدیوی نهایی (Export)</h3>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="text-stone-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <SubtitleVideoExport
              videoUrl={videoUrl}
              segments={segments as any}
              style={{
                fontId: styleConfig.fontFamily,
                color: styleConfig.textColor,
                hlColor: styleConfig.activeWordColor,
                karaoke: true,
              } as any}
            />
          </div>
        </div>
      )}
    </div>
  )
}
