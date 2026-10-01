'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVideoTranscribe } from '@/lib/use-video-transcribe'
import { StudioStyleConfig, getStoredStyle, saveStoredStyle } from '@/lib/studio/unified-style'
import { renderStudioFrame, clampCanvasDimensions, calculateVideoRect } from '@/lib/studio/universal-renderer'
import { ensureFontLoaded } from '../../lib/studio/font-loader'
import { useVideoExport } from '@/components/transcribe/export/useVideoExport'
import UploadScreen from './UploadScreen'
import StylePanel from './StylePanel'
import InstagramCaptionPanel from './InstagramCaptionPanel'
import { PRESETS, MAX_CPS } from './constants'
import type { Seg, Snapshot, Preset } from './types'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
const fmt = (t: number): string => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`
let editorIdCounter = 0
const uid = (): string => { editorIdCounter++; return `seg_${Date.now()}_${editorIdCounter}_${Math.random().toString(36).substring(2, 7)}` }

export default function SubtitleEditor() {
  const [videoUrl, setVideoUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedSegId, setSelectedSegId] = useState<string | null>(null)
  const [editingSegId, setEditingSegId] = useState<string | null>(null)
  const [editingOnCanvas, setEditingOnCanvas] = useState(false)
  const [canvasOverlayBox, setCanvasOverlayBox] = useState<{ anchorX: number; anchorY: number; width: number; height: number; fontSize: number } | null>(null)
  const [timelineZoom, setTimelineZoom] = useState(100)
  const [showStyle, setShowStyle] = useState(false)
  const [showCaptionPanel, setShowCaptionPanel] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showSafe, setShowSafe] = useState(true)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [fontLoaded, setFontLoaded] = useState(false)
  const [history, setHistory] = useState<Snapshot[]>([])
  const [redoStack, setRedoStack] = useState<Snapshot[]>([])
  const [saving, setSaving] = useState(false)
  const [restored, setRestored] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [generatingCaption, setGeneratingCaption] = useState<string | null>(null)
  const [captionText, setCaptionText] = useState('')
  const [captionHashtags, setCaptionHashtags] = useState('')
  const [waveform, setWaveform] = useState<number[]>([])
  const [isDraggingSubtitle, setIsDraggingSubtitle] = useState(false)
  
  const subtitleDragStart = useRef<{ x: number; y: number; styleX: number; styleY: number; moved: boolean } | null>(null)
  const beforeSubtitleDragRef = useRef<Snapshot | null>(null)
  const positionHandleRef = useRef<{ pointerId: number; startX: number; startY: number; styleX: number; styleY: number; snapshot: Snapshot } | null>(null)
  const { status, progress, busy, segments, setSegments, run, stop } = useVideoTranscribe()
  const [styleConfig, setStyleConfig] = useState<StudioStyleConfig>(() => getStoredStyle())
  
  // ✅ استفاده صحیح از useVideoExport
  const {
    exporting,
    progress: exportProgress,
    stageText: exportStage,
    exportVideo,
    cancelExport,
  } = useVideoExport(sourceFile)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const timelineScrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; mode: 'move' | 'left' | 'right'; startX: number; start: number; end: number } | null>(null)
  const timelineDragMovedRef = useRef(false)
  const beforeDragRef = useRef<Snapshot | null>(null)
  const beforeEditRef = useRef<Snapshot | null>(null)

  const style = styleConfig as unknown as Record<string, any>
  const fontId = style.fontId ?? style.fontFamily ?? 'Vazirmatn'
  const x = Number(style.positionXPercent ?? style.x ?? 50)
  const y = Number(style.positionYPercent ?? style.y ?? 82)

  const toastMsg = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(v => v === message ? null : v), 2600)
  }, [])

  const makeSnapshot = useCallback((): Snapshot => ({ segments: clone(segments), style: clone(styleConfig as any) }), [segments, styleConfig])
  const recordBefore = useCallback((snapshot?: Snapshot) => {
    setHistory(prev => [...prev, snapshot ?? makeSnapshot()].slice(-80))
    setRedoStack([])
  }, [makeSnapshot])

  const updateStyle = useCallback((patch: Record<string, unknown>, record = true) => {
    if (record) recordBefore()
    setStyleConfig(prev => { const next = { ...(prev as any), ...patch } as StudioStyleConfig; saveStoredStyle(next); return next })
  }, [recordBefore])

  const undo = useCallback(() => {
    setHistory(prev => {
      if (!prev.length) return prev
      const target = prev[prev.length - 1] as Snapshot
      if (!target) return prev
      setRedoStack(r => [...r, { segments: clone(segments), style: clone(styleConfig as any) }].slice(-80))
      setSegments(clone((target as any).segments))
      setStyleConfig((target as any).style as StudioStyleConfig)
      saveStoredStyle((target as any).style)
      return prev.slice(0, -1)
    })
  }, [segments, styleConfig, setSegments])

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (!prev.length) return prev
      const target = prev[prev.length - 1] as Snapshot
      if (!target) return prev
      setHistory(h => [...h, { segments: clone(segments), style: clone(styleConfig as any) }].slice(-80))
      setSegments(clone((target as any).segments))
      setStyleConfig((target as any).style as StudioStyleConfig)
      saveStoredStyle((target as any).style)
      return prev.slice(0, -1)
    })
  }, [segments, styleConfig, setSegments])

  useEffect(() => {
    let active = true
    setFontLoaded(false)
    ensureFontLoaded(fontId).then(() => active && setFontLoaded(true)).catch(() => active && setFontLoaded(true))
    return () => { active = false }
  }, [fontId])

  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(null), 2600); return () => window.clearTimeout(id) }, [toast])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, language = 'fa') => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 250 * 1024 * 1024) { toastMsg('حجم فایل بیشتر از ۲۵۰ مگابایت است.'); e.target.value = ''; return }
    setFileName(file.name); setSourceFile(file); setVideoUrl(URL.createObjectURL(file))
    setSelectedSegId(null); setHistory([]); setRedoStack([]); setRestored(false)
    await run(file, language)
  }

  useEffect(() => { return () => { if (videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl) } }, [videoUrl])

  useEffect(() => {
    const v = videoRef.current; if (!v) return
    const onTime = () => setCurrentTime(v.currentTime)
    const onMeta = () => setDuration(Number.isFinite(v.duration) ? v.duration : 0)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    v.addEventListener('timeupdate', onTime); v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('durationchange', onMeta); v.addEventListener('play', onPlay); v.addEventListener('pause', onPause)
    if (v.readyState >= HTMLMediaElement.HAVE_METADATA) onMeta()
    return () => {
      v.removeEventListener('timeupdate', onTime); v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('durationchange', onMeta); v.removeEventListener('play', onPlay); v.removeEventListener('pause', onPause)
    }
  }, [videoUrl])

  const activeSeg = useMemo(() => segments.find((s: any) => currentTime >= s.start && currentTime < s.end) ?? null, [segments, currentTime])

  const seek = useCallback((t: number) => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, Math.min(duration || Infinity, t)); setCurrentTime(t) }, [duration])
  const togglePlay = useCallback(() => { const v = videoRef.current; if (!v) return; v.paused ? v.play().catch(() => {}) : v.pause() }, [])

  const splitAt = useCallback((id: string, at = currentTime) => {
    const seg = segments.find((s: any) => s.id === id)
    if (!seg || at <= seg.start + 0.05 || at >= seg.end - 0.05) { toastMsg('پلی‌هد باید داخل همان سگمنت باشد.'); return }
    const words = seg.text.trim().split(/\s+/).filter(Boolean)
    if (words.length <= 1) { toastMsg('متن برای برش خیلی کوتاه است.'); return }
    const before = makeSnapshot()
    const cut = Math.max(1, Math.min(words.length - 1, Math.round(words.length * ((at - seg.start) / Math.max(0.001, seg.end - seg.start)))))
    const firstWords = seg.words ? seg.words.filter((w: any) => w.end <= at) : []
    const secondWords = seg.words ? seg.words.filter((w: any) => w.start >= at) : []
    const first: any = { ...seg, id: seg.id || uid(), end: at, text: words.slice(0, cut).join(' ') || seg.text, words: firstWords.length > 0 ? firstWords : undefined }
    const second: any = { ...seg, id: uid(), start: at, text: words.slice(cut).join(' ') || seg.text, words: secondWords.length > 0 ? secondWords : undefined }
    recordBefore(before); setSegments(prev => prev.flatMap(s => s.id === id ? [first, second] : [s])); setSelectedSegId(second.id)
  }, [segments, currentTime, makeSnapshot, recordBefore, setSegments, toastMsg])

  const mergeSeg = useCallback((id: string) => {
    const idx = segments.findIndex((s: any) => s.id === id)
    if (idx < 0 || idx >= segments.length - 1) return
    const a = segments[idx], b = segments[idx + 1]
    const before = makeSnapshot()
    const mergedWords = [...(a.words ?? []), ...(b.words ?? [])]
    recordBefore(before)
    setSegments(prev => prev.filter(s => s.id !== b.id).map(s => s.id === a.id ? { ...s, end: b.end, text: `${s.text} ${b.text}`.trim(), words: mergedWords } : s))
  }, [segments, makeSnapshot, recordBefore, setSegments])

  const deleteSeg = useCallback((id: string) => { const before = makeSnapshot(); recordBefore(before); setSegments(prev => prev.filter(s => s.id !== id)); setSelectedSegId(prev => prev === id ? null : prev) }, [makeSnapshot, recordBefore, setSegments])
  
  const addSeg = useCallback(() => {
    const start = currentTime; const end = Math.min(duration || start + 2.5, start + 2.5)
    const before = makeSnapshot(); recordBefore(before)
    const seg: any = { id: uid(), start, end: Math.max(start + .2, end), text: 'متن جدید' }
    setSegments(prev => [...prev, seg].sort((a: any, b: any) => a.start - b.start))
    setSelectedSegId(seg.id); setEditingSegId(seg.id)
  }, [currentTime, duration, makeSnapshot, recordBefore, setSegments])

  const onTimelinePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = timelineScrollRef.current; if (!el || !duration) return
    if ((e.target as HTMLElement).closest('[data-seg-id]')) return
    const rect = el.getBoundingClientRect(); const localX = e.clientX - rect.left + el.scrollLeft
    seek((localX / Math.max(1, el.scrollWidth)) * duration)
  }

  const beginSegDrag = (id: string, mode: 'move' | 'left' | 'right', e: React.PointerEvent) => {
    e.stopPropagation(); const seg = segments.find((s: any) => s.id === id); const el = timelineScrollRef.current
    if (!seg || !el || !duration) return
    timelineDragMovedRef.current = false
    setSelectedSegId(id); beforeDragRef.current = makeSnapshot()
    dragRef.current = { id, mode, startX: e.clientX, start: seg.start, end: seg.end }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onTimelinePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current; const el = timelineScrollRef.current; if (!drag || !el || !duration) return
    if (Math.abs(e.clientX - drag.startX) > 2) timelineDragMovedRef.current = true
    const delta = ((e.clientX - drag.startX) / Math.max(1, el.scrollWidth)) * duration
    let start = drag.start, end = drag.end
    if (drag.mode === 'move') { const len = drag.end - drag.start; start = Math.max(0, Math.min(duration - len, drag.start + delta)); end = start + len }
    else if (drag.mode === 'left') start = Math.max(0, Math.min(drag.end - 0.2, drag.start + delta))
    else end = Math.min(duration, Math.max(drag.start + 0.2, drag.end + delta))
    setSegments(prev => prev.map(s => s.id === drag.id ? { ...s, start, end } : s).sort((a: any, b: any) => a.start - b.start))
  }

  const endSegDrag = () => { if (!dragRef.current) return; const before = beforeDragRef.current; dragRef.current = null; beforeDragRef.current = null; if (before && timelineDragMovedRef.current) recordBefore(before) }
  
  const applyPreset = (preset: Preset) => {
    updateStyle({
      templateId: preset.id,
      fontId: preset.fontId,
      fontFamily: preset.fontId,
      fontSizePercent: preset.size,
      fontWeight: preset.id === 'bold' || preset.id === 'viral' ? '900' : 'bold',
      italic: false,
      textColor: preset.color,
      activeWordColor: preset.hlColor,
      hasBg: preset.bgOpacity > 0,
      bgColor: preset.bgColor,
      bgOpacity: preset.bgOpacity,
      bgRadius: preset.bgRadius,
      hasShadow: true,
      shadowColor: preset.textShadowColor,
      shadowBlur: preset.textShadowBlur,
      shadowX: 0,
      shadowY: 2,
      hasTextStroke: preset.outline,
      textStrokeColor: preset.textShadowColor,
      textStrokeWidth: preset.outline ? 2 : 0,
      bgBorderWidth: 0,
      hasActiveWordBg: false,
    })
    ensureFontLoaded(preset.fontId)
    toastMsg(`قالب «${preset.name}» روی همهٔ زیرنویس‌ها اعمال شد.`)
  }
  const applyFont = (id: string) => {
    updateStyle({ fontId: id, fontFamily: id })
    ensureFontLoaded(id)
  }

  const getCanvasSubtitleBounds = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const video = videoRef.current
    const fit = style.contentFit === 'cover' ? 'cover' : 'contain'
    const videoRect = fit === 'cover'
      ? { drawX: 0, drawW: canvas.width }
      : calculateVideoRect(canvas.width, canvas.height, video?.videoWidth || canvas.width, video?.videoHeight || canvas.height, fit)
    const scaleX = rect.width / Math.max(1, canvas.width)
    return {
      left: rect.left + videoRect.drawX * scaleX,
      top: rect.top,
      width: videoRect.drawW * scaleX,
      height: rect.height,
    }
  }, [style.contentFit])

  // ✅ درگ زیرنویس با Pointer Events (موس + تاچ)
  const handleSubtitleDragStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = getCanvasSubtitleBounds(); if (!bounds) return
    const clickX = ((e.clientX - bounds.left) / bounds.width) * 100
    const clickY = ((e.clientY - bounds.top) / bounds.height) * 100
    if (clickX >= 0 && clickX <= 100 && Math.abs(clickX - x) < 45 && Math.abs(clickY - y) < 12) {
      setIsDraggingSubtitle(true)
      beforeSubtitleDragRef.current = makeSnapshot()
      subtitleDragStart.current = { x: e.clientX, y: e.clientY, styleX: x, styleY: y, moved: false }
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      e.preventDefault()
    }
  }

  const handleSubtitleDragMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingSubtitle || !subtitleDragStart.current) return
    const bounds = getCanvasSubtitleBounds(); if (!bounds) return
    if (Math.hypot(e.clientX - subtitleDragStart.current.x, e.clientY - subtitleDragStart.current.y) > 4) subtitleDragStart.current.moved = true
    const newX = Math.max(5, Math.min(95, subtitleDragStart.current.styleX + ((e.clientX - subtitleDragStart.current.x) / bounds.width) * 100))
    const newY = Math.max(5, Math.min(95, subtitleDragStart.current.styleY + ((e.clientY - subtitleDragStart.current.y) / bounds.height) * 100))
    updateStyle({ positionXPercent: newX, positionYPercent: newY }, false)
    e.preventDefault()
  }

  const handleSubtitleDragEnd = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingSubtitle) {
      const drag = subtitleDragStart.current
      setIsDraggingSubtitle(false)
      if (e) (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
      subtitleDragStart.current = null
      if (drag?.moved && beforeSubtitleDragRef.current) recordBefore(beforeSubtitleDragRef.current)
      beforeSubtitleDragRef.current = null
      if (e?.type === 'pointerup' && !drag?.moved && activeSeg) {
        beforeEditRef.current = makeSnapshot()
        setSelectedSegId(activeSeg.id)
        setEditingSegId(activeSeg.id)
        setEditingOnCanvas(true)
        videoRef.current?.pause()
        requestAnimationFrame(updateCanvasOverlayBox)
      }
    }
  }

  const handlePositionPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    positionHandleRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      styleX: x,
      styleY: y,
      snapshot: makeSnapshot(),
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDraggingSubtitle(true)
  }

  const handlePositionPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = positionHandleRef.current
    const bounds = getCanvasSubtitleBounds()
    if (!drag || drag.pointerId !== e.pointerId || !bounds) return
    e.preventDefault()
    updateStyle({
      positionXPercent: Math.max(5, Math.min(95, drag.styleX + ((e.clientX - drag.startX) / bounds.width) * 100)),
      positionYPercent: Math.max(5, Math.min(95, drag.styleY + ((e.clientY - drag.startY) / bounds.height) * 100)),
    }, false)
  }

  const handlePositionPointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = positionHandleRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    positionHandleRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setIsDraggingSubtitle(false)
    recordBefore(drag.snapshot)
  }

  const updateCanvasOverlayBox = useCallback(() => {
    const preview = previewRef.current
    const canvas = canvasRef.current
    const bounds = getCanvasSubtitleBounds()
    if (!canvas || !preview || !bounds) return
    const canvasRect = canvas.getBoundingClientRect()
    const previewRect = preview.getBoundingClientRect()
    const fit = style.contentFit === 'cover' ? 'cover' : 'contain'
    const refWidth = fit === 'cover' ? canvas.width : bounds.width * canvas.width / Math.max(1, canvasRect.width)
    const fontSize = Math.max(14, refWidth * Number(style.fontSizePercent ?? 4.8) / 100) * canvasRect.width / Math.max(1, canvas.width)
    const maxWidth = bounds.width * 0.88
    const activeTextLength = String(activeSeg?.text ?? '').length
    const estimatedWidth = Math.min(maxWidth, Math.max(120, activeTextLength * fontSize * 0.58 + 30))
    const lineCount = Math.max(1, Math.ceil(activeTextLength * fontSize * 0.58 / Math.max(1, estimatedWidth - 24)))
    setCanvasOverlayBox({
      anchorX: bounds.left - previewRect.left + bounds.width * x / 100,
      anchorY: canvasRect.top - previewRect.top + canvasRect.height * y / 100,
      width: estimatedWidth,
      height: Math.max(fontSize * 1.8, lineCount * fontSize * 1.45 + 14),
      fontSize,
    })
  }, [activeSeg?.text, getCanvasSubtitleBounds, style.contentFit, style.fontSizePercent, x, y])

  useEffect(() => {
    updateCanvasOverlayBox()
    window.addEventListener('resize', updateCanvasOverlayBox)
    return () => window.removeEventListener('resize', updateCanvasOverlayBox)
  }, [activeSeg?.id, editingOnCanvas, updateCanvasOverlayBox])

  const finishCanvasTextEdit = () => {
    if (beforeEditRef.current) recordBefore(beforeEditRef.current)
    beforeEditRef.current = null
    setEditingOnCanvas(false)
    setEditingSegId(null)
  }

  const drawFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    let W = video.videoWidth || 1080
    let H = video.videoHeight || 1920
    
    if (style.aspectRatio === '9:16') { W = 1080; H = 1920 }
    else if (style.aspectRatio === '16:9') { W = 1920; H = 1080 }
    else if (style.aspectRatio === '1:1') { W = 1080; H = 1080 }
    else if (style.aspectRatio === '4:5') { W = 1080; H = 1350 }
    
    const out = clampCanvasDimensions(W, H, 1920)
    
    if (canvas.width !== out.width || canvas.height !== out.height) {
      canvas.width = out.width
      canvas.height = out.height
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    renderStudioFrame({
      ctx,
      canvasWidth: out.width,
      canvasHeight: out.height,
      video,
      currentTime: video.currentTime,
      segments: segments as any,
      style: styleConfig
    })
  }, [segments, styleConfig, style])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const drawWhenReady = () => { if (fontLoaded) drawFrame() }
    video.addEventListener('loadeddata', drawWhenReady)
    video.addEventListener('seeked', drawWhenReady)
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) drawWhenReady()
    return () => {
      video.removeEventListener('loadeddata', drawWhenReady)
      video.removeEventListener('seeked', drawWhenReady)
    }
  }, [drawFrame, fontLoaded, videoUrl])

  useEffect(() => {
    if (!fontLoaded) return; if (!isPlaying) { drawFrame(); return }
    let raf = 0; const loop = () => { drawFrame(); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf)
  }, [drawFrame, fontLoaded, isPlaying])

  useEffect(() => {
    if (!segments.length || !fileName) return
    const project = { version: 3, projectId: fileName, fileName, segments, style: styleConfig, currentTime, savedAt: Date.now() }
    setSaving(true)
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(`subtitle-project:${fileName}`, JSON.stringify(project)); setLastSaved(new Date()); setSaving(false) }
      catch { setSaving(false); toastMsg('ذخیره خودکار انجام نشد.') }
    }, 900)
    return () => window.clearTimeout(timer)
  }, [segments, styleConfig, fileName, currentTime, toastMsg])

  const readingSpeed = (seg: any): number => seg.text.length / Math.max(0.05, seg.end - seg.start)

  const handleTranslate = async (targetLang: 'fa' | 'en') => {
    if (!segments.length || translating) return
    setTranslating(true)
    try {
      const pad = (n: number, z = 2) => String(Math.floor(n)).padStart(z, '0')
      const time = (sec: number) => `${pad(sec / 3600)}:${pad((sec % 3600) / 60)}:${pad(sec % 60)},${String(Math.floor((sec % 1) * 1000)).padStart(3, '0')}`
      const srt = segments.map((s: any, i: number) => `${i + 1}\n${time(s.start)} --> ${time(s.end)}\n${s.text}`).join('\n\n')
      const res = await fetch('/api/translate-srt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ srtContent: srt, targetLang }) })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'ترجمه انجام نشد؛ دوباره تلاش کنید.')
      if (!data.srt) throw new Error('پاسخ ترجمه خالی بود.')
      const parsed = data.srt.trim().replace(/\r\n/g, '\n').split(/\n\s*\n/).map((b: string) => b.trim().split('\n').slice(2).join(' ').trim())
      if (parsed.length !== segments.length) throw new Error('تعداد بخش‌های ترجمه با زیرنویس‌ها برابر نیست.')
      recordBefore(makeSnapshot()); setSegments(segments.map((seg: any, i: number) => ({ ...seg, text: parsed[i] || seg.text }))); toastMsg('ترجمه انجام شد.')
    } catch (error: any) { toastMsg(`خطا در ترجمه: ${error?.message || 'نامشخص'}`) }
    finally { setTranslating(false) }
  }

  const handleGenerateCaption = async (tone: string) => {
    if (!segments.length || generatingCaption) return
    setGeneratingCaption(tone)
    try {
      const res = await fetch('/api/generate-caption', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: segments.map((s: any) => s.text).join(' '), language: 'fa', tone }) })
      const data = await res.json()
      if (!res.ok || !data.caption) throw new Error(data.error || 'خطا')
      setCaptionText(data.caption); setCaptionHashtags(data.hashtags || ''); toastMsg('کپشن اینستاگرام ساخته شد.')
    } catch (e: any) { toastMsg(`خطا در تولید کپشن: ${e?.message || 'نامشخص'}`) }
    finally { setGeneratingCaption(null) }
  }

  if (!videoUrl) return <UploadScreen onFileSelect={handleFile} />

  const timelineWidth = Math.max(100, timelineZoom)

  return (
    <div className="flex min-h-[100dvh] w-full min-w-0 flex-col bg-[#070605] text-white lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden" dir="rtl">
      <header className="shrink-0 border-b border-stone-800 bg-[#110f0d] px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="min-w-0 max-w-[22rem] truncate text-sm font-black">{fileName}</h1>
          <span className="text-[10px] text-stone-500">{saving ? 'در حال ذخیره…' : lastSaved ? `ذخیره ${fmt(lastSaved.getTime() / 1000)}` : ''}</span>
          <div className="mr-auto flex max-w-full flex-wrap items-center gap-1">
            <button aria-label="Undo" onClick={undo} disabled={!history.length} className="rounded-lg bg-stone-800 px-2 py-1.5 text-xs disabled:opacity-30"></button>
            <button aria-label="Redo" onClick={redo} disabled={!redoStack.length} className="rounded-lg bg-stone-800 px-2 py-1.5 text-xs disabled:opacity-30">↷</button>
            <button onClick={() => setShowStyle(true)} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400">⚙ استایل</button>
            <button onClick={() => setShowCaptionPanel(true)} disabled={!segments.length} className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-300 disabled:opacity-40">📸 کپشن اینستاگرام</button>
            <button onClick={() => setShowExport(true)} className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black text-black">خروجی MP4</button>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-none flex-col lg:flex-1 lg:flex-row">
        <section className="relative flex min-h-0 min-w-0 flex-none flex-col bg-black lg:flex-1">
          {!busy && status.startsWith('خطا در پردازش ویدیو:') && (
            <div role="alert" className="absolute left-1/2 top-3 z-40 w-[min(36rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl border border-red-500/40 bg-red-950/95 p-3 text-xs leading-6 text-red-100 shadow-xl">
              {status}
            </div>
          )}
          {busy && (
            <div className="absolute left-1/2 top-14 z-30 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-white/15 bg-stone-900/95 p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="truncate text-white">در حال آماده‌سازی زیرنویس</p>
                  <p className="mt-1 text-[10px] text-stone-400">{progress}%</p>
                </div>
                <button onClick={stop} className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-stone-200">توقف</button>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-stone-800">
                <div className="h-full bg-sky-400 transition-[width] duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          
          {/* ✅ ناحیه تصویر با ابعاد ثابت */}
          <div ref={previewRef} className="relative flex h-[52dvh] min-h-[360px] max-h-[620px] flex-none items-center justify-center p-2 sm:p-4 lg:h-auto lg:min-h-0 lg:max-h-none lg:flex-1" style={{ touchAction: 'none' }}>
            <canvas
              ref={canvasRef}
              onPointerDown={handleSubtitleDragStart}
              onPointerMove={handleSubtitleDragMove}
              onPointerUp={handleSubtitleDragEnd}
              onPointerCancel={handleSubtitleDragEnd}
              className={`block h-full w-auto max-h-full max-w-full ${isDraggingSubtitle ? 'cursor-grabbing' : 'cursor-crosshair'} object-contain`}
              style={{ touchAction: 'none' }}
            />
            {activeSeg && canvasOverlayBox && !editingOnCanvas && (
              <div
                aria-label="محدودهٔ زیرنویس فعال"
                className="pointer-events-none absolute z-20 rounded-sm border border-amber-400/90 shadow-[0_0_0_1px_rgba(0,0,0,0.65)]"
                style={{
                  left: canvasOverlayBox.anchorX,
                  top: canvasOverlayBox.anchorY,
                  width: canvasOverlayBox.width,
                  height: canvasOverlayBox.height,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <button
                  type="button"
                  aria-label="گرفتن و جابه‌جایی زیرنویس"
                  title="برای جابه‌جایی بکشید"
                  onPointerDown={handlePositionPointerDown}
                  onPointerMove={handlePositionPointerMove}
                  onPointerUp={handlePositionPointerEnd}
                  onPointerCancel={handlePositionPointerEnd}
                  className="pointer-events-auto absolute -top-3 left-1/2 flex h-6 min-w-10 -translate-x-1/2 touch-none items-center justify-center rounded-full border border-white bg-amber-400 px-1 text-[12px] font-black leading-none text-black shadow-lg cursor-move"
                  style={{ touchAction: 'none' }}
                >
                  ↕⤢
                </button>
              </div>
            )}
            {editingOnCanvas && editingSegId && canvasOverlayBox && (
              <textarea
                autoFocus
                aria-label="ویرایش زیرنویس روی تصویر"
                dir="auto"
                value={String(segments.find((seg: any) => seg.id === editingSegId)?.text ?? '')}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                onChange={e => setSegments(prev => prev.map(seg => seg.id === editingSegId ? { ...seg, text: e.target.value } : seg))}
                onBlur={finishCanvasTextEdit}
                onKeyDown={e => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() }
                  if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur()
                }}
                className="absolute z-30 resize-y rounded-xl border-2 border-amber-300 bg-black/85 p-2 text-center font-bold leading-relaxed text-white shadow-xl outline-none"
                style={{
                  left: canvasOverlayBox.anchorX,
                  top: canvasOverlayBox.anchorY,
                  width: canvasOverlayBox.width,
                  minHeight: Math.max(48, canvasOverlayBox.height * 0.06),
                  maxHeight: canvasOverlayBox.height * 0.4,
                  transform: 'translate(-50%, -50%)',
                  fontFamily: style.fontFamily || 'Vazirmatn, sans-serif',
                  fontSize: `${canvasOverlayBox.fontSize}px`,
                }}
              />
            )}
            <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-lg bg-black/65 px-2.5 py-1.5 text-[10px] text-white/80">
              برای حرکت، دستگیرهٔ ↕⤢ را بکشید؛ برای ویرایش، روی متن زیرنویس بزنید
            </div>
            <video ref={videoRef} src={videoUrl} className="hidden" playsInline />
            {showSafe && <div className="pointer-events-none absolute inset-0 z-10" style={{ inset: '10%', border: '2px dashed rgba(255, 255, 255, 0.3)', borderRadius: '8px' }} />}
          </div>
          
          <div className="shrink-0 border-t border-stone-800 bg-[#110f0d] px-3 py-2">
            <div className="flex items-center gap-2">
              <button aria-label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay} className="h-9 w-9 shrink-0 rounded-xl bg-amber-500 text-black">{isPlaying ? '⏸' : '▶'}</button>
              <input aria-label="Video progress" type="range" min={0} max={duration || 1} step={0.05} value={currentTime} onChange={e => seek(Number(e.target.value))} className="min-w-0 flex-1 accent-amber-500" />
              <span className="shrink-0 font-mono text-[10px] text-stone-400">{fmt(currentTime)} / {fmt(duration)}</span>
            </div>
          </div>
          
          <div className="shrink-0 border-t border-stone-800 bg-[#0e0d0b] p-2 sm:p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-stone-400">Timeline</span>
              <input aria-label="Timeline zoom" type="range" min={50} max={800} value={timelineZoom} onChange={e => setTimelineZoom(Number(e.target.value))} className="w-28 accent-amber-500" />
              <span className="text-[10px] text-stone-500">{timelineZoom}%</span>
              <button onClick={() => setShowSafe(v => !v)} className={`rounded-lg px-2 py-1 text-[10px] ${showSafe ? 'bg-amber-500 text-black' : 'bg-stone-800 text-stone-400'}`}>Safe Zone</button>
              <button onClick={() => { const id = selectedSegId ?? activeSeg?.id; if (id) splitAt(id) }} className="rounded-lg bg-stone-800 px-2 py-1 text-[10px]">✂ Split</button>
              <button onClick={() => selectedSegId && mergeSeg(selectedSegId)} className="rounded-lg bg-stone-800 px-2 py-1 text-[10px]">Merge</button>
              <button onClick={addSeg} className="rounded-lg bg-amber-500/10 px-2 py-1 text-[10px] text-amber-400">+ افزودن</button>
              <button onClick={() => handleTranslate('fa')} disabled={translating} className="rounded-lg bg-blue-500/10 px-2 py-1 text-[10px] text-blue-400">ترجمه FA</button>
              <button onClick={() => handleTranslate('en')} disabled={translating} className="rounded-lg bg-green-500/10 px-2 py-1 text-[10px] text-green-400">ترجمه EN</button>
            </div>
            
            <div ref={timelineScrollRef} onPointerDown={onTimelinePointerDown} onPointerMove={onTimelinePointerMove} onPointerUp={endSegDrag} onPointerCancel={endSegDrag} className="relative h-24 overflow-x-auto overflow-y-hidden rounded-xl bg-stone-950 overscroll-x-contain" style={{ scrollbarGutter: 'stable', touchAction: 'pan-x' }}>
              <div className="relative h-full" style={{ width: `${timelineWidth}%`, minWidth: '100%' }}>
                <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between px-1 text-[8px] text-stone-600"><span>0:00</span><span>{fmt(duration)}</span></div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 top-7 flex items-end gap-px px-1 opacity-25">
                  {waveform.map((v, i) => <span key={`wave-${i}`} className="min-w-[1px] flex-1 rounded-t bg-stone-300" style={{ height: `${Math.max(4, v * 100)}%` }} />)}
                </div>
                {segments.map((seg: any) => {
                  const safeId = seg.id || uid()
                  const left = duration ? (seg.start / duration) * 100 : 0
                  const width = duration ? ((seg.end - seg.start) / duration) * 100 : 0
                  const fast = readingSpeed(seg) > MAX_CPS
                  const selected = selectedSegId === seg.id
                  const isEditing = editingSegId === safeId

                  return (
                    <div
                      key={safeId}
                      data-seg-id={safeId}
                      onClick={e => {
                        e.stopPropagation()
                        if (timelineDragMovedRef.current) { timelineDragMovedRef.current = false; return }
                        setSelectedSegId(safeId)
                        seek(seg.start)
                        if (editingSegId !== safeId) {
                          beforeEditRef.current = makeSnapshot()
                          setEditingOnCanvas(false)
                          setEditingSegId(safeId)
                        }
                      }}
                      className={`absolute bottom-2 top-7 rounded-lg border cursor-pointer ${selected ? 'border-amber-300 bg-amber-500/60' : 'border-amber-500/20 bg-amber-500/25'} ${fast ? 'ring-2 ring-red-500/80' : ''}`}
                      style={{ left: `${left}%`, width: `${Math.max(width, 0.35)}%`, minWidth: 16 }}
                    >
                      <div onPointerDown={e => beginSegDrag(safeId, 'left', e)} onClick={e => e.stopPropagation()} className="absolute inset-y-0 left-0 z-20 w-2 cursor-ew-resize rounded-l bg-amber-400/60" />
                      <div onPointerDown={e => beginSegDrag(safeId, 'move', e)} className="absolute inset-0 cursor-grab px-1 py-1 text-[9px] text-white active:cursor-grabbing">
                        {isEditing && !editingOnCanvas ? (
                          <textarea
                            autoFocus
                            value={seg.text}
                            onChange={e => setSegments(prev => prev.map(s => s.id === safeId ? { ...s, text: e.target.value } : s))}
                            onPointerDown={e => e.stopPropagation()}
                            onBlur={() => {
                              if (beforeEditRef.current) recordBefore(beforeEditRef.current)
                              beforeEditRef.current = null
                              setEditingSegId(null)
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() }
                              if (e.key === 'Escape') setEditingSegId(null)
                            }}
                            onClick={e => e.stopPropagation()}
                            className="w-full h-full bg-black/80 text-[9px] text-white resize-none outline-none border border-amber-500/50 rounded p-0.5"
                            rows={2}
                          />
                        ) : (
                          <div onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); if (timelineDragMovedRef.current) { timelineDragMovedRef.current = false; return }; setSelectedSegId(safeId); seek(seg.start); if (editingSegId !== safeId) beforeEditRef.current = makeSnapshot(); setEditingOnCanvas(false); setEditingSegId(safeId) }} className="w-full h-full flex flex-col justify-center">
                            <span className="block truncate">{seg.text}</span>
                            {fast && <span className="absolute bottom-0 right-1 text-[8px] text-red-300">CPS {readingSpeed(seg).toFixed(1)}</span>}
                          </div>
                        )}
                      </div>
                      <div onPointerDown={e => beginSegDrag(safeId, 'right', e)} onClick={e => e.stopPropagation()} className="absolute inset-y-0 right-0 z-20 w-2 cursor-ew-resize rounded-r bg-amber-400/60" />
                    </div>
                  )
                })}
                <div className="pointer-events-none absolute bottom-0 top-0 z-30 w-0.5 bg-amber-400" style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </section>

        <aside className="flex min-h-[300px] w-full shrink-0 flex-col border-t border-stone-800 bg-[#0e0d0b] lg:max-h-none lg:min-h-0 lg:w-[min(400px,38vw)] lg:border-l lg:border-t-0">
          <div className="shrink-0 border-b border-stone-800 bg-[#12100d] p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">کپشن‌ها ({segments.length})</span>
              <span className="text-[10px] text-stone-500">CPS بالای {MAX_CPS} = هشدار</span>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
            {segments.map((seg: any) => {
              const safeId = seg.id || uid()
              const selected = selectedSegId === seg.id
              const active = activeSeg?.id === seg.id
              const fast = readingSpeed(seg) > MAX_CPS
              return (
                <div key={safeId} className={`rounded-xl border ${active ? 'border-amber-500/70 bg-amber-500/10' : selected ? 'border-amber-500/40 bg-stone-800/70' : 'border-stone-800 bg-stone-900/60'}`}>
                  <div className="flex flex-wrap items-center gap-1 border-b border-stone-800/70 p-2">
                    <button onClick={() => seek(seg.start)} className="font-mono text-[10px] text-amber-400">{fmt(seg.start)}</button>
                    <span className="text-stone-600">→</span>
                    <button onClick={() => seek(seg.end)} className="font-mono text-[10px] text-amber-400">{fmt(seg.end)}</button>
                    <span className={`mr-auto text-[9px] ${fast ? 'text-red-400' : 'text-stone-500'}`}>CPS {readingSpeed(seg).toFixed(1)}</span>
                    <button aria-label="Split caption" onClick={() => splitAt(safeId)} className="rounded bg-stone-800 px-1.5 py-1 text-[10px]">✂</button>
                    <button aria-label="Merge caption" onClick={() => mergeSeg(safeId)} className="rounded bg-stone-800 px-1.5 py-1 text-[10px]">↔</button>
                    <button aria-label="Delete caption" onClick={() => deleteSeg(safeId)} className="rounded bg-red-500/10 px-1.5 py-1 text-[10px] text-red-400">✕</button>
                  </div>
                  {editingSegId === safeId && !editingOnCanvas ? (
                    <textarea autoFocus dir="auto" value={seg.text} onChange={e => setSegments((prev: any[]) => prev.map(s => s.id === safeId ? { ...s, text: e.target.value } : s))} onBlur={() => { if (beforeEditRef.current) recordBefore(beforeEditRef.current); beforeEditRef.current = null; setEditingSegId(null) }} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() } }} className="m-2 w-[calc(100%-1rem)] resize-none rounded-lg border border-amber-500/50 bg-black/50 p-2 text-xs outline-none" rows={3} />
                  ) : (
                    <button onClick={() => { beforeEditRef.current = makeSnapshot(); setEditingOnCanvas(false); setEditingSegId(safeId); setSelectedSegId(safeId) }} className="block w-full p-2 text-right text-xs leading-6 text-white/90" dir="auto">{seg.text}</button>
                  )}
                </div>
              )
            })}
          </div>
        </aside>
      </main>

      {showStyle && <StylePanel style={style} fontId={fontId} onClose={() => setShowStyle(false)} onApplyPreset={applyPreset} onApplyFont={applyFont} onUpdateStyle={updateStyle} makeSnapshot={makeSnapshot} recordBefore={recordBefore} />}
      {showCaptionPanel && (
        <InstagramCaptionPanel
          generatingTone={generatingCaption}
          caption={captionText}
          hashtags={captionHashtags}
          onGenerate={handleGenerateCaption}
          onChange={(caption, hashtags) => { setCaptionText(caption); setCaptionHashtags(hashtags) }}
          onClose={() => setShowCaptionPanel(false)}
          onCopy={() => navigator.clipboard.writeText(captionText + (captionHashtags ? `\n\n${captionHashtags}` : '')).then(() => toastMsg('کپی شد.')).catch(() => toastMsg('کپی انجام نشد.'))}
        />
      )}
      
      {showExport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3" onMouseDown={() => !exporting && setShowExport(false)}>
          <div onMouseDown={e => e.stopPropagation()} className="w-full max-w-md rounded-3xl border border-stone-800 bg-[#14120f] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">خروجی نهایی ویدیو</h3>
              {!exporting && <button onClick={() => setShowExport(false)} className="text-stone-400 hover:text-white">✕</button>}
            </div>
            {exporting ? (
              <div className="space-y-4 text-center">
                <div className="text-xs text-amber-400 font-mono">{exportStage || 'در حال پردازش...'}</div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-800">
                  <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${exportProgress}%` }} />
                </div>
                <button onClick={cancelExport} className="w-full rounded-lg border border-red-500/30 bg-red-500/10 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20">لغو عملیات</button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-stone-400 text-center">
                  ویدیو با نسبت تصویر <span className="text-amber-400 font-bold">{(styleConfig as any).aspectRatio || '16:9'}</span> و کیفیت بالا رندر خواهد شد.
                </p>
                <button
                  onClick={() => exportVideo(videoUrl, segments as any, styleConfig as any, fileName.replace(/\.[^.]+$/, ''))}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 py-3 text-xs font-black text-black transition-all hover:from-amber-500 hover:to-amber-400"
                >
                  شروع رندر و دانلود MP4 ⚡
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {toast && <div role="status" aria-live="polite" className="fixed bottom-4 left-1/2 z-[200] -translate-x-1/2 rounded-xl border border-stone-700 bg-stone-900 px-4 py-2 text-xs shadow-2xl">{toast}</div>}
    </div>
  )
}