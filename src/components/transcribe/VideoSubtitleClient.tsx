'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { TranscriptSegment } from '@/lib/live-transcribe'
import { decodeToPcm16k } from '@/lib/audio'
import { prepareWavChunks } from '@/lib/audio-enhance'
import { toSrt, toVtt, toTxt, download } from '@/lib/subtitle'
import { useAuth } from '@/lib/use-auth'

const WORKER = 'https://gemini-live-proxy.ahmadsobhani1993.workers.dev'

const FONTS = [
  { id: 'Vazirmatn', label: 'وزیرمتن' },
  { id: 'Lalezar', label: 'لاله‌زار' },
  { id: 'Markazi Text', label: 'مرکزی' },
  { id: 'Noto Nastaliq Urdu', label: 'نستعلیق' },
  { id: 'Noto Kufi Arabic', label: 'کوفی' },
  { id: 'Cairo', label: 'قاهره' },
  { id: 'Tajawal', label: 'تجوال' },
  { id: 'Readex Pro', label: 'ریدکس' },
  { id: 'IBM Plex Sans Arabic', label: 'پلکس' },
  { id: 'Amiri', label: 'امیری' },
  { id: 'Reem Kufi', label: 'ریم کوفی' },
  { id: 'Aref Ruqaa', label: 'رقعه' },
  { id: 'Gulzar', label: 'گلزار' },
  { id: 'Jomhuria', label: 'جمهوری' },
]

const PRESETS = [
  { id: 'viral', label: '🔥 وایرال', fontId: 'Lalezar', size: 8, color: '#ffffff', bgOpacity: 0, outline: true, karaoke: true, hlColor: '#ffe14d' },
  { id: 'minimal', label: '⬜ مینیمال', fontId: 'Vazirmatn', size: 5, color: '#ffffff', bgOpacity: 0.55, outline: false, karaoke: false, hlColor: '#ffe14d' },
  { id: 'podcast', label: '🎙 پادکست', fontId: 'Readex Pro', size: 6, color: '#ffffff', bgOpacity: 0.7, outline: false, karaoke: true, hlColor: '#7CFC00' },
  { id: 'cinema', label: '🎬 سینمایی', fontId: 'Amiri', size: 5, color: '#f5f5f4', bgOpacity: 0, outline: true, karaoke: false, hlColor: '#ffe14d' },
  { id: 'news', label: '📰 خبری', fontId: 'Noto Kufi Arabic', size: 6, color: '#ffffff', bgOpacity: 0.85, outline: false, karaoke: false, hlColor: '#ff5555' },
]

type Word = { w: string; start: number; end: number }
type Fx = 'none' | 'pop' | 'zoomIn' | 'zoomOut' | 'slide'
type Seg = TranscriptSegment & { words: Word[]; fx?: Fx; hl?: string }

type Style = {
  fontId: string
  size: number
  color: string
  bgOpacity: number
  outline: boolean
  x: number | null
  y: number | null
  karaoke: boolean
  hlColor: string
}

const DEFAULT_STYLE: Style = { fontId: 'Vazirmatn', size: 6, color: '#ffffff', bgOpacity: 0.55, outline: true, x: null, y: null, karaoke: true, hlColor: '#ffe14d' }

const HL_COLORS = ['', '#e11d48', '#f59e0b', '#16a34a', '#2563eb', '#7c3aed']

async function loadFont(id: string) {
  const lid = 'gf-' + id.replace(/\s+/g, '-')
  if (!document.getElementById(lid)) {
    const l = document.createElement('link')
    l.id = lid
    l.rel = 'stylesheet'
    l.href = `https://fonts.googleapis.com/css2?family=${id.replace(/ /g, '+')}:wght@400;700;800&display=swap`
    document.head.appendChild(l)
  }
  try { await (document as any).fonts?.load(`800 40px "${id}"`) } catch {}
}

const easeOutBack = (x: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w } else line = test
  }
  if (line) lines.push(line)
  return lines
}

const mkWords = (text: string, start: number, end: number): Word[] => {
  const toks = text.split(/\s+/).filter(Boolean)
  const lens = toks.map((t) => t.length)
  const total = lens.reduce((a, b) => a + b, 0) || 1
  let c = start
  return toks.map((w, k) => {
    const d = Math.max(0.12, (lens[k] / total) * (end - start))
    const r = { w, start: c, end: c + d }
    c += d
    return r
  })
}

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

export default function VideoSubtitleClient() {
  const auth = useAuth()

  const [videoUrl, setVideoUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [segments, setSegments] = useState<Seg[]>([])
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE)
  const [customFonts, setCustomFonts] = useState<{ id: string; label: string }[]>([])
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [vidW, setVidW] = useState(0)
  const [vidH, setVidH] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [expProg, setExpProg] = useState(0)
  const [selected, setSelected] = useState(-1)
  const [zoom, setZoom] = useState(40)
  const [showSafe, setShowSafe] = useState(false)
  const [showAdv, setShowAdv] = useState(false)
  const [findQ, setFindQ] = useState('')
  const [replQ, setReplQ] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const styleRef = useRef(style)
  styleRef.current = style
  const segRef = useRef(segments)
  segRef.current = segments
  const histRef = useRef<string[]>([])
  const futRef = useRef<string[]>([])

  useEffect(() => { loadFont(style.fontId) }, [style.fontId])

  const baseName = fileName.replace(/\.[^.]+$/, '') || 'video'
  const current = segments.find((s) => time >= s.start && time <= s.end)

  // ─── Undo / Redo ───
  const snapshot = () => {
    histRef.current.push(JSON.stringify({ segments, style }))
    if (histRef.current.length > 60) histRef.current.shift()
    futRef.current = []
  }
  const undo = () => {
    const h = histRef.current.pop()
    if (!h) return
    futRef.current.push(JSON.stringify({ segments, style }))
    const s = JSON.parse(h)
    setSegments(s.segments)
    setStyle(s.style)
  }
  const redo = () => {
    const h = futRef.current.pop()
    if (!h) return
    histRef.current.push(JSON.stringify({ segments, style }))
    const s = JSON.parse(h)
    setSegments(s.segments)
    setStyle(s.style)
  }

  // ─── Auto-Save ───
  useEffect(() => {
    if (!fileName || segments.length === 0) return
    const t = setTimeout(() => {
      try { localStorage.setItem('subproj:' + baseName, JSON.stringify({ segments, style })) } catch {}
    }, 800)
    return () => clearTimeout(t)
  }, [segments, style, baseName, fileName])

  // ─── میان‌برهای کیبورد ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const v = videoRef.current
      if (!v) return
      if (e.code === 'Space') { e.preventDefault(); v.paused ? v.play() : v.pause() }
      if (e.code === 'ArrowRight') v.currentTime = Math.min(v.duration, v.currentTime + 1)
      if (e.code === 'ArrowLeft') v.currentTime = Math.max(0, v.currentTime - 1)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const seek = (t: number) => { if (videoRef.current) videoRef.current.currentTime = t }

  // ─── درگ زیرنویس با موس ───
  const onSubPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const move = (ev: PointerEvent) => {
      const x = Math.min(95, Math.max(5, ((ev.clientX - rect.left) / rect.width) * 100))
      const y = Math.min(95, Math.max(5, ((ev.clientY - rect.top) / rect.height) * 100))
      setStyle((s) => ({ ...s, x, y }))
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const addCustomFont = async (f: File) => {
    try {
      const name = f.name.replace(/\.[^.]+$/, '')
      const url = URL.createObjectURL(f)
      const face = new FontFace(name, `url(${url})`)
      await face.load()
      ;(document as any).fonts.add(face)
      setCustomFonts((p) => [...p.filter((x) => x.id !== name), { id: name, label: `${name} (دلخواه)` }])
      setStyle((s) => ({ ...s, fontId: name }))
    } catch {
      alert('❌ فونت نامعتبر — فایل ttf/otf/woff بده')
    }
  }

  // ─── ترنسکریپت REST (کلید مخفی) ───
  const runTranscribe = async (file: File) => {
    setSegments([])
    setProgress(0)
    setBusy(true)

    try {
      setStatus('۱. دیکود صدا (محلی)…')
      const pcm = await decodeToPcm16k(file)
      const parts = await prepareWavChunks(pcm, 30)
      if (parts.length === 0) { setStatus('❌ صدایی پیدا نشد'); setBusy(false); return }

      setStatus('۲. ترنسکریپت (مدل اختصاصی)…')
      // 🔒 کلید در URL نیست — فقط Worker از env می‌خواند
      const newSegs: Seg[] = []

      for (let i = 0; i < parts.length; i++) {
        const r = await fetch(`${WORKER}/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBase64: parts[i].data }),
        })
        const j = await r.json()

        // خطای Gemini را کامل نمایش بده (برای دیباگ)
        if (!r.ok || j.error) {
          const errMsg = j.error || `HTTP ${r.status}`
          throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg))
        }

        const text: string = (j.text || '').trim()

        if (text) {
          const sentences = text.match(/[^.!?؟\n]+[.!?؟]?/g) || [text]
          const words = sentences.map((s2) => s2.split(/\s+/).length)
          const totalW = words.reduce((a, b) => a + b, 0) || 1
          const dur = parts[i].end - parts[i].start
          let cursor = parts[i].start
          sentences.forEach((s2, k) => {
            const d = Math.max(0.5, (words[k] / totalW) * dur)
            const seg: Seg = { text: s2.trim(), start: cursor, end: cursor + d, words: mkWords(s2.trim(), cursor, cursor + d) }
            cursor += d
            newSegs.push(seg)
          })
        }
        setProgress(Math.round(((i + 1) / parts.length) * 100))
      }

      if (newSegs.length === 0) {
        setStatus('⚠️ متنی دریافت نشد — فایل دیگری امتحان کن')
      } else {
        setSegments(newSegs)
        setStatus('✅ آماده — ادیت کن و خروجی بگیر')
      }
    } catch (err: any) {
      setStatus('❌ ' + (err?.message || String(err)))
    } finally {
      setBusy(false)
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('video/')) { setStatus('❌ فقط فایل ویدیویی'); return }
    setFileName(file.name)
    setVideoUrl(URL.createObjectURL(file))
    await runTranscribe(file)
  }

  const updateSeg = (i: number, patch: Partial<Seg>, hist = true) => {
    if (hist) snapshot()
    setSegments(segments.map((s, idx) => {
      if (idx !== i) return s
      const next = { ...s, ...patch }
      if (patch.text !== undefined) next.words = mkWords(next.text, next.start, next.end)
      return next
    }))
  }

  const splitSeg = (i: number) => {
    const s = segments[i]
    const toks = s.text.split(/\s+/)
    if (toks.length < 2) return
    snapshot()
    const half = Math.ceil(toks.length / 2)
    const mid = s.start + (s.end - s.start) * (half / toks.length)
    const a: Seg = { ...s, text: toks.slice(0, half).join(' '), start: s.start, end: mid, words: [] }
    const b: Seg = { ...s, text: toks.slice(half).join(' '), start: mid, end: s.end, words: [] }
    a.words = mkWords(a.text, a.start, a.end)
    b.words = mkWords(b.text, b.start, b.end)
    setSegments([...segments.slice(0, i), a, b, ...segments.slice(i + 1)])
  }

  const mergeSeg = (i: number) => {
    if (i >= segments.length - 1) return
    snapshot()
    const a = segments[i]
    const b = segments[i + 1]
    const m: Seg = { ...a, text: a.text + ' ' + b.text, end: b.end, words: [] }
    m.words = mkWords(m.text, m.start, m.end)
    setSegments([...segments.slice(0, i), m, ...segments.slice(i + 2)])
  }

  const findReplace = () => {
    if (!findQ) return
    snapshot()
    setSegments(segments.map((s) => {
      const t = s.text.split(findQ).join(replQ)
      return { ...s, text: t, words: mkWords(t, s.start, s.end) }
    }))
  }

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    snapshot()
    setStyle((s) => ({ ...s, fontId: p.fontId, size: p.size, color: p.color, bgOpacity: p.bgOpacity, outline: p.outline, karaoke: p.karaoke, hlColor: p.hlColor }))
  }

  const cps = (s: Seg) => s.text.length / Math.max(0.5, s.end - s.start)

  // ─── خروجی ویدیو (رزولوشن اصلی) ───
  const exportVideo = async () => {
    if (exporting || !videoUrl) return
    setExporting(true)
    setExpProg(0)
    try {
      const video = document.createElement('video')
      video.src = videoUrl
      video.playsInline = true
      await new Promise((res, rej) => { video.onloadedmetadata = () => res(null); video.onerror = () => rej(new Error('load failed')) })

      const W = video.videoWidth
      const H = video.videoHeight
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')!

      const ac = new AudioContext()
      const srcNode = ac.createMediaElementSource(video)
      const dest = ac.createMediaStreamDestination()
      srcNode.connect(dest)

      const st0 = styleRef.current
      await loadFont(st0.fontId)

      const stream = canvas.captureStream(30)
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))

      const mime = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) || ''
      const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: Math.max(8_000_000, W * H * 10) })
      const parts: Blob[] = []
      rec.ondataavailable = (e) => e.data.size && parts.push(e.data)
      const stopped = new Promise((res) => (rec.onstop = () => res(null)))
      rec.start(1000)

      const drawFrame = () => {
        const t = video.currentTime
        const seg = segRef.current.find((s) => t >= s.start && t <= s.end)
        const t01 = seg ? Math.min(1, Math.max(0, (t - seg.start) / Math.max(0.1, seg.end - seg.start))) : 0

        let vs = 1
        if (seg?.fx === 'zoomIn') vs = 1 + 0.12 * t01
        if (seg?.fx === 'zoomOut') vs = 1.12 - 0.12 * t01
        const sw = W / vs
        const sh = H / vs
        ctx.drawImage(video, (W - sw) / 2, (H - sh) / 2, sw, sh, 0, 0, W, H)

        if (!seg) return
        const s2 = styleRef.current

        let ts = 1
        if (seg.fx === 'pop') ts = easeOutBack(Math.min(1, (t - seg.start) / 0.35))
        if (seg.fx === 'zoomIn') ts = 0.8 + 0.35 * t01
        if (seg.fx === 'zoomOut') ts = 1.15 - 0.35 * t01
        let dx = 0
        if (seg.fx === 'slide') dx = (1 - Math.min(1, (t - seg.start) / 0.4)) * W * 0.1
        const px = Math.max(10, Math.round((s2.size / 100) * H * ts))

        const anchor = s2.x != null
          ? { x: (s2.x / 100) * W + dx, y: (s2.y / 100) * H }
          : { x: W / 2 + dx, y: H - H * 0.08 }

        ctx.textBaseline = 'middle'

        if (s2.karaoke && seg.words?.length) {
          ctx.font = `700 ${px}px "${s2.fontId}"`
          const spaceW = ctx.measureText(' ').width
          const ws = seg.words.map((wd) => ({ ...wd, width: ctx.measureText(wd.w).width }))
          const total = ws.reduce((a, b) => a + b.width, 0) + spaceW * (ws.length - 1)

          if (s2.bgOpacity > 0 || seg.hl) {
            ctx.fillStyle = seg.hl || `rgba(0,0,0,${s2.bgOpacity})`
            ctx.fillRect(anchor.x - total / 2 - px * 0.5, anchor.y - px, total + px, px * 2)
          }

          ctx.textAlign = 'left'
          let cx = anchor.x + total / 2
          for (const wd of ws) {
            const active = t >= wd.start && t <= wd.end
            const wpx = active ? Math.round(px * 1.15) : px
            ctx.font = `${active ? 800 : 700} ${wpx}px "${s2.fontId}"`
            const x = cx - wd.width
            if (s2.outline) {
              ctx.lineWidth = Math.max(2, wpx * 0.12)
              ctx.strokeStyle = '#000'
              ctx.lineJoin = 'round'
              ctx.strokeText(wd.w, x, anchor.y)
            }
            ctx.fillStyle = active ? s2.hlColor : s2.color
            ctx.fillText(wd.w, x, anchor.y)
            cx -= wd.width + spaceW
          }
        } else {
          ctx.font = `700 ${px}px "${s2.fontId}"`
          ctx.textAlign = 'center'
          const lines = wrapText(ctx, seg.text, W * 0.9)
          const lh = px * 1.5
          const totalH = lines.length * lh
          const y0 = s2.x != null ? anchor.y - totalH / 2 : anchor.y - totalH

          lines.forEach((ln, i) => {
            const y = y0 + i * lh + lh / 2
            if (s2.bgOpacity > 0 || seg.hl) {
              const w = ctx.measureText(ln).width + px
              ctx.fillStyle = seg.hl || `rgba(0,0,0,${s2.bgOpacity})`
              ctx.fillRect(anchor.x - w / 2, y - lh / 2, w, lh)
            }
            if (s2.outline) {
              ctx.lineWidth = Math.max(2, px * 0.12)
              ctx.strokeStyle = '#000'
              ctx.lineJoin = 'round'
              ctx.strokeText(ln, anchor.x, y)
            }
            ctx.fillStyle = s2.color
            ctx.fillText(ln, anchor.x, y)
          })
        }
      }

      let raf = 0
      const loop = () => {
        drawFrame()
        setExpProg(video.duration ? video.currentTime / video.duration : 0)
        if (!video.ended) raf = requestAnimationFrame(loop)
      }

      await video.play()
      raf = requestAnimationFrame(loop)
      await new Promise((res) => (video.onended = () => res(null)))
      cancelAnimationFrame(raf)
      rec.stop()
      await stopped
      ac.close()

      const blob = new Blob(parts, { type: mime || 'video/webm' })
      const ext = (mime || '').includes('mp4') ? 'mp4' : 'webm'
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${baseName}.subtitled.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    } catch (e: any) {
      alert('❌ خروجی ناموفق: ' + (e?.message || e))
    } finally {
      setExporting(false)
    }
  }

  const fxAnim = (seg: Seg) => {
    const dur = Math.max(0.3, seg.end - seg.start)
    if (seg.fx === 'pop') return 'subPop 0.35s ease-out both'
    if (seg.fx === 'zoomIn') return `subZoomIn ${dur}s linear both`
    if (seg.fx === 'zoomOut') return `subZoomOut ${dur}s linear both`
    if (seg.fx === 'slide') return 'subSlide 0.4s ease-out both'
    return undefined
  }

  if (auth === 'checking') return <div className="p-10 text-center text-sm text-ink-muted">در حال بررسی…</div>
  if (auth === 'no')
    return (
      <div className="container-app mx-auto max-w-3xl p-6" dir="rtl">
        <div className="space-y-4 rounded-2xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 p-8 text-center">
          <p className="text-sm text-ink-muted">برای استفاده از استودیو زیرنویس، ابتدا باید وارد حساب کاربری خود شوید.</p>
          <Link href="/login" className="inline-block rounded-xl border border-amber-500/60 px-6 py-2.5 text-sm text-amber-400 transition hover:bg-amber-500/10">ورود به حساب کاربری</Link>
        </div>
      </div>
    )

  return (
    <div className="container-app mx-auto max-w-6xl space-y-4 p-4" dir="rtl">
      <style>{`
        @keyframes subPop { 0% { transform: scale(0.5); opacity: 0 } 60% { transform: scale(1.1) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes subZoomIn { from { transform: scale(0.8) } to { transform: scale(1.2) } }
        @keyframes subZoomOut { from { transform: scale(1.2) } to { transform: scale(0.8) } }
        @keyframes subSlide { from { transform: translateX(-40px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
      `}</style>

      {/* هدر */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-extrabold">🎬 استودیو زیرنویس — {baseName}</h1>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={undo} className="rounded bg-gray-700 px-2 py-1 hover:bg-gray-600">↩ Undo</button>
          <button onClick={redo} className="rounded bg-gray-700 px-2 py-1 hover:bg-gray-600">↪ Redo</button>
          <button onClick={() => setShowSafe(!showSafe)} className={`rounded px-2 py-1 ${showSafe ? 'bg-blue-600 text-white' : 'bg-gray-700'}`}>Safe Zone</button>
          {vidW > 0 && <span className="rounded bg-gray-800 px-2 py-1 text-ink-muted">خروجی: {vidW}×{vidH} (اصلی)</span>}
          <Link href="/transcribe" className="rounded bg-gray-700 px-2 py-1 hover:bg-gray-600">🎙 صدا به متن</Link>
        </div>
      </div>

      {/* آپلود */}
      <div className="card space-y-2 p-3">
        <input type="file" accept="video/*" disabled={busy || exporting} onChange={handleFile} className="block w-full text-sm text-ink-muted file:ml-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-700 disabled:opacity-50" />
        {busy && (
          <div className="h-2 w-full overflow-hidden rounded bg-gray-700">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {status && (
          <div className={`rounded-lg p-2 text-xs ${status.startsWith('✅') ? 'bg-green-500/10 text-green-400' : status.startsWith('❌') ? 'bg-red-500/10 text-red-400' : status.startsWith('⚠️') ? 'bg-yellow-500/10 text-yellow-400' : 'bg-blue-500/10 text-blue-400'}`}>{status}</div>
        )}
      </div>

      {videoUrl && (
        <>
          {/* پیش‌نمایش 16:9 + درگ */}
          <div ref={stageRef} className="relative w-full overflow-hidden rounded-xl bg-black aspect-video select-none" style={{ containerType: 'inline-size' }}>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              playsInline
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); setVidW(e.currentTarget.videoWidth); setVidH(e.currentTarget.videoHeight) }}
              className="h-full w-full object-contain"
            />

            {showSafe && (
              <>
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[12%] bg-red-500/20 border-b border-red-500/50" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] bg-red-500/20 border-t border-red-500/50" />
              </>
            )}

            {current && (
              <div
                onPointerDown={onSubPointerDown}
                className="absolute cursor-move px-2"
                style={
                  style.x != null
                    ? { left: `${style.x}%`, top: `${style.y}%`, transform: 'translate(-50%,-50%)', maxWidth: '90%' }
                    : { insetX: 0, bottom: '6%', left: 0, right: 0, display: 'flex', justifyContent: 'center' }
                }
              >
                <span
                  key={current.start + current.text}
                  dir="rtl"
                  className="text-center"
                  style={{
                    fontFamily: `"${style.fontId}"`,
                    fontWeight: 700,
                    fontSize: `clamp(12px, ${style.size}cqi, 60px)`,
                    color: style.color,
                    backgroundColor: current.hl || (style.bgOpacity > 0 ? `rgba(0,0,0,${style.bgOpacity})` : 'transparent'),
                    padding: '0.2em 0.6em',
                    borderRadius: '0.5em',
                    textShadow: style.outline ? '0 2px 6px rgba(0,0,0,0.9)' : 'none',
                    animation: fxAnim(current),
                  }}
                >
                  {style.karaoke && current.words?.length ? (
                    current.words.map((wd, i) => {
                      const active = time >= wd.start && time <= wd.end
                      return (
                        <span key={i} style={{ display: 'inline-block', color: active ? style.hlColor : style.color, transform: active ? 'scale(1.15)' : undefined, fontWeight: active ? 800 : 700, transition: 'transform .12s, color .12s' }}>
                          {wd.w}{' '}
                        </span>
                      )
                    })
                  ) : (
                    current.text
                  )}
                </span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-ink-muted">💡 زیرنویس را با موس بگیر و جابه‌جا کن — خروجی با رزولوشن اصلی ویدیو ({vidW || '—'}×{vidH || '—'}) رندر می‌شود.</p>

          {/* Preset ها */}
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button key={p.id} onClick={() => applyPreset(p)} className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs hover:bg-gray-700">{p.label}</button>
            ))}
            <label className="cursor-pointer rounded-lg bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-700">
              ＋ فونت دلخواه
              <input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={(e) => e.target.files?.[0] && addCustomFont(e.target.files[0])} />
            </label>
            <button onClick={() => setShowAdv(!showAdv)} className={`rounded-lg px-3 py-1.5 text-xs ${showAdv ? 'bg-blue-600 text-white' : 'bg-gray-800'}`}>⚙ تنظیمات بیشتر</button>
          </div>

          {showAdv && (
            <div className="card grid grid-cols-2 gap-3 p-3 text-xs sm:grid-cols-4 lg:grid-cols-7">
              <div>
                <div className="mb-1 text-ink-muted">فونت</div>
                <select value={style.fontId} onChange={(e) => setStyle({ ...style, fontId: e.target.value })} className="w-full rounded bg-gray-700 p-1.5">
                  {customFonts.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <div className="mb-1 text-ink-muted">اندازه: {style.size}٪</div>
                <input type="range" min={3} max={12} value={style.size} onChange={(e) => setStyle({ ...style, size: Number(e.target.value) })} className="w-full" />
              </div>
              <div>
                <div className="mb-1 text-ink-muted">رنگ متن</div>
                <input type="color" value={style.color} onChange={(e) => setStyle({ ...style, color: e.target.value })} className="h-7 w-full cursor-pointer rounded border-0 bg-transparent p-0" />
              </div>
              <div>
                <div className="mb-1 text-ink-muted">رنگ کاراوکه</div>
                <input type="color" value={style.hlColor} onChange={(e) => setStyle({ ...style, hlColor: e.target.value })} className="h-7 w-full cursor-pointer rounded border-0 bg-transparent p-0" />
              </div>
              <div>
                <div className="mb-1 text-ink-muted">پس‌زمینه: {Math.round(style.bgOpacity * 100)}٪</div>
                <input type="range" min={0} max={100} value={Math.round(style.bgOpacity * 100)} onChange={(e) => setStyle({ ...style, bgOpacity: Number(e.target.value) / 100 })} className="w-full" />
              </div>
              <div>
                <div className="mb-1 text-ink-muted">حاشیه</div>
                <button onClick={() => setStyle({ ...style, outline: !style.outline })} className={`rounded px-3 py-1 ${style.outline ? 'bg-blue-600 text-white' : 'bg-gray-700'}`}>{style.outline ? 'روشن' : 'خاموش'}</button>
              </div>
              <div>
                <div className="mb-1 text-ink-muted">مکان</div>
                <button onClick={() => setStyle({ ...style, x: null, y: null })} className="rounded bg-gray-700 px-3 py-1">بازگشت به پایین</button>
              </div>
            </div>
          )}

          {/* تایم‌لاین */}
          {duration > 0 && (
            <div className="card space-y-2 p-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-ink-muted">تایم‌لاین</span>
                <input type="range" min={10} max={120} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-32" />
                <span className="font-mono text-ink-muted">{time.toFixed(1)}s / {duration.toFixed(1)}s</span>
              </div>
              <div className="overflow-x-auto rounded-lg bg-gray-900 p-2">
                <div
                  className="relative h-16"
                  style={{ width: Math.max(300, duration * zoom) }}
                  onPointerDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    seek(Math.max(0, Math.min(duration, (e.clientX - rect.left) / zoom)))
                  }}
                >
                  {segments.map((s, i) => (
                    <div
                      key={i}
                      onPointerDown={(e) => { e.stopPropagation(); setSelected(i); seek(s.start) }}
                      className={`absolute top-2 h-8 cursor-pointer rounded border text-center text-[10px] leading-8 ${i === selected ? 'border-blue-400 bg-blue-600/60' : 'border-gray-600 bg-gray-700/70'} ${cps(s) > 22 ? '!border-yellow-500' : ''}`}
                      style={{ left: s.start * zoom, width: Math.max(14, (s.end - s.start) * zoom) }}
                      title={s.text}
                    >
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          const startX = e.clientX
                          const origStart = s.start
                          const move = (ev: PointerEvent) => updateSeg(i, { start: Math.max(0, origStart + (ev.clientX - startX) / zoom) }, false)
                          const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
                          snapshot()
                          window.addEventListener('pointermove', move)
                          window.addEventListener('pointerup', up)
                        }}
                        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/30"
                      />
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          const startX = e.clientX
                          const origEnd = s.end
                          const move = (ev: PointerEvent) => updateSeg(i, { end: Math.max(s.start + 0.3, origEnd + (ev.clientX - startX) / zoom) }, false)
                          const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
                          snapshot()
                          window.addEventListener('pointermove', move)
                          window.addEventListener('pointerup', up)
                        }}
                        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/30"
                      />
                    </div>
                  ))}
                  <div className="pointer-events-none absolute top-0 h-full w-0.5 bg-red-500" style={{ left: time * zoom }} />
                </div>
              </div>
            </div>
          )}

          {/* Transcript + Inspector */}
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="card space-y-2 p-3 lg:col-span-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <strong>Transcript ({segments.length})</strong>
                <input placeholder="جستجو" value={findQ} onChange={(e) => setFindQ(e.target.value)} className="rounded bg-gray-700 px-2 py-1" />
                <input placeholder="جایگزینی" value={replQ} onChange={(e) => setReplQ(e.target.value)} className="rounded bg-gray-700 px-2 py-1" />
                <button onClick={findReplace} className="rounded bg-blue-600 px-2 py-1 text-white">اعمال</button>
              </div>
              <div className="max-h-[24rem] space-y-2 overflow-y-auto">
                {segments.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => { setSelected(i); seek(s.start) }}
                    className={`cursor-pointer rounded-lg p-2 ${time >= s.start && time <= s.end ? 'bg-blue-600/20 ring-1 ring-blue-500' : 'bg-gray-800/50 hover:bg-gray-800'}`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="font-mono text-ink-muted">{s.start.toFixed(1)}–{s.end.toFixed(1)}</span>
                      {cps(s) > 22 && <span className="text-yellow-400" title="سرعت خواندن زیاد">⚠️ تند</span>}
                      <select value={s.fx || 'none'} onChange={(e) => updateSeg(i, { fx: e.target.value as Fx })} className="rounded bg-gray-700 p-0.5">
                        <option value="none">بدون افکت</option>
                        <option value="pop">پاپ</option>
                        <option value="zoomIn">زوم این</option>
                        <option value="zoomOut">زوم اوت</option>
                        <option value="slide">اسلاید</option>
                      </select>
                      <div className="flex items-center gap-1">
                        {HL_COLORS.map((c) => (
                          <button key={c || 'none'} onClick={() => updateSeg(i, { hl: c || undefined })} className={`h-4 w-4 rounded border ${(s.hl || '') === c ? 'border-white' : 'border-gray-600'}`} style={{ backgroundColor: c || 'transparent' }} />
                        ))}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); splitSeg(i) }} className="rounded bg-gray-700 px-1.5">✂️</button>
                      <button onClick={(e) => { e.stopPropagation(); mergeSeg(i) }} className="rounded bg-gray-700 px-1.5">🔗</button>
                      <button onClick={(e) => { e.stopPropagation(); snapshot(); setSegments(segments.filter((_, idx) => idx !== i)) }} className="mr-auto text-red-400">✕</button>
                    </div>
                    <textarea value={s.text} rows={1} onClick={(e) => e.stopPropagation()} onChange={(e) => updateSeg(i, { text: e.target.value })} className="mt-1 w-full resize-y bg-transparent text-sm outline-none" />
                  </div>
                ))}
              </div>
            </div>

            {/* خروجی‌ها */}
            <div className="card space-y-2 p-3">
              <strong className="text-sm">خروجی</strong>
              <button onClick={() => download(`${baseName}.srt`, toSrt(segments), 'text/plain')} className="block w-full rounded bg-blue-600 px-3 py-2 text-xs text-white">⬇ SRT</button>
              <button onClick={() => download(`${baseName}.vtt`, toVtt(segments), 'text/vtt')} className="block w-full rounded bg-blue-600 px-3 py-2 text-xs text-white">⬇ VTT</button>
              <button onClick={() => download(`${baseName}.txt`, toTxt(segments))} className="block w-full rounded bg-gray-700 px-3 py-2 text-xs">⬇ TXT</button>
              <button onClick={exportVideo} disabled={exporting || segments.length === 0} className="block w-full rounded bg-green-600 px-3 py-2 text-xs text-white hover:bg-green-700 disabled:opacity-50">
                {exporting ? `⏳ رندر ${Math.round(expProg * 100)}٪` : '🎥 خروجی ویدیو (رزولوشن اصلی)'}
              </button>
              {exporting && (
                <div className="h-2 w-full overflow-hidden rounded bg-gray-700">
                  <div className="h-full bg-green-600 transition-all" style={{ width: `${Math.round(expProg * 100)}%` }} />
                </div>
              )}
              <p className="text-[11px] leading-5 text-ink-muted">
                میان‌برها: Space پخش/توقف • ← → پرش ۱ ثانیه • Ctrl+Z Undo • Ctrl+Shift+Z Redo
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
