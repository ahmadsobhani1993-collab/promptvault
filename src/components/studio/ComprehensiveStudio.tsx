'use client'

import React, { useState, useEffect } from 'react'
import { CaptionSegment, StyleConfig, DenoiseSettings } from '@/lib/studio/types'
import ClassicDesktopView from './ClassicDesktopView'
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
  contentFit: 'fit',
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

  // تشخیص هوشمند دستگاه: دسکتاپ به نمای کلاسیک، موبایل به استودیوی پیشرفته
  const [viewMode, setViewMode] = useState<'classic' | 'advanced'>('classic')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('advanced')
    }
  }, [])

  // موتور صوتی
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const audioEngineRef = React.useRef<AudioEngine>(new AudioEngine())
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

  const handleTranslate = async () => {
    const translated = await translateCaptionSegments(segments, 'fa')
    setSegments(
      translated.map((t) => ({
        ...t,
        text: t.translatedText || t.text,
      }))
    )
  }

  // ۱. رندر نمای کلاسیک در دسکتاپ
  if (viewMode === 'classic') {
    return (
      <ClassicDesktopView
        videoUrl={videoUrl}
        segments={segments}
        onUpdateSegments={setSegments}
        styleConfig={styleConfig}
        onUpdateStyle={(p) => setStyleConfig((s) => ({ ...s, ...p }))}
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onSeek={seek}
        onTranslate={handleTranslate}
        onChangeVideo={onClose}
        onSwitchToAdvanced={() => setViewMode('advanced')}
        denoiseSettings={denoiseSettings}
        onUpdateDenoise={(p) => setDenoiseSettings((d) => ({ ...d, ...p }))}
      />
    )
  }

  // ۲. رندر استودیوی عمودی پیشرفته در موبایل یا حالت انتخابی
  return (
    <div className="relative flex flex-col h-screen w-screen bg-[#070605] overflow-hidden select-none">
      <StudioHeader
        onClose={onClose}
        onExportClick={() => setShowExportModal(true)}
        onTranslateClick={handleTranslate}
        segments={segments}
        onImportSRT={(newSegs) => setSegments(newSegs)}
      />

      <div className="relative flex flex-1 overflow-hidden">
        <StudioToolbar activeTool={activeTool} setActiveTool={setActiveTool} />

        <StudioPreview
          videoUrl={videoUrl}
          currentTime={currentTime}
          styleConfig={styleConfig}
          currentSegment={
            segments.find((s) => currentTime >= s.start && currentTime <= s.end) || null
          }
          videoRef={videoRef}
          onVideoClick={togglePlay}
        />

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
              <PreparePostPanel segments={segments} onClose={() => setActiveTool('none')} />
            )}
          </div>
        )}
      </div>

      <StudioTimeline
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onSeek={seek}
        segments={segments}
        selectedSegmentId={selectedSegmentId}
        onSelectSegment={setSelectedSegmentId}
        onUndo={() => {}}
        onRedo={() => {}}
        canUndo={false}
        canRedo={false}
      />
    </div>
  )
}
