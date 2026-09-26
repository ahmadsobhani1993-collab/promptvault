'use client'

import { useState, useRef, useCallback } from 'react'

type Seg = { id: string; start: number; end: number; text: string; words?: { w: string; start: number; end: number }[]; fx?: string; hl?: string }
type Style = {
  fontId: string; size: number; color: string; hlColor: string
  bgOpacity: number; outline: boolean; karaoke: boolean
  x: number | null; y: number | null; direction?: 'rtl' | 'ltr' | 'auto'
  align?: 'right' | 'center' | 'left'
  bold?: boolean; italic?: boolean; underline?: boolean
  textShadowBlur?: number; textShadowColor?: string; bgRadius?: number
  fontFamily?: string
}

type Props = {
  videoUrl: string
  sourceFile?: File | null
  segments: Seg[]
  setSegments: (s: Seg[]) => void
  style: Style
  baseName: string
}

type ActiveTab = 'canvas' | 'style' | 'text' | 'audio' | 'caption' | 'translate'

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const fmt = (t: number) => { const m = Math.floor(t / 60); const s = Math.floor(t % 60); return `${m}:${s.toString().padStart(2, '0')}` }

const FONTS = [
  { id: 'Vazirmatn', label: 'وزیرمتن' },
  { id: 'Lalezar', label: 'لاله‌زار' },
  { id: 'Dana', label: 'دانا' },
  { id: 'Doran', label: 'دوران' },
  { id: 'Peyda', label: 'پیدا' },
]

const HL_COLORS = ['#FFD600', '#FF6B6B', '#4FC3F7', '#FF4081', '#69F0AE', '#B388FF', '#FFAB40', '']

function wrapTextSafe(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines: string[] = []
  let currentLine = ''
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine); currentLine = word
    } else { currentLine = testLine }
  }
  if (currentLine) lines.push(currentLine)
  return lines.length ? lines : ['']
}

function fitSubtitle(ctx: CanvasRenderingContext2D, text: string, desiredFontSize: number, maxWidth: number, maxHeight: number, fontFamily: string) {
  let fontSize = Math.max(12, desiredFontSize)
  for (let i = 0; i < 20; i++) {
    ctx.font = `800 ${fontSize}px "${fontFamily}", sans-serif`
    const lines = wrapTextSafe(ctx, text, maxWidth)
    const lineHeight = fontSize * 1.3
    const totalHeight = lines.length * lineHeight
    const maxLineWidth = Math.max(...lines.map((l) => ctx.measureText(l).width), 0)
    if (maxLineWidth <= maxWidth && totalHeight <= maxHeight) {
      return { fontSize, lines, lineHeight, totalHeight, maxLineWidth }
    }
    fontSize *= 0.94
  }
  ctx.font = `800 ${fontSize}px "${fontFamily}", sans-serif`
  const lines = wrapTextSafe(ctx, text, maxWidth)
  return { fontSize, lines, lineHeight: fontSize * 1.3, totalHeight: lines.length * (fontSize * 1.3), maxLineWidth: Math.max(...lines.map((l) => ctx.measureText(l).width), 0) }
}

function drawSubtitleOnCanvas(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, W: number, H: number, mediaTime: number, duration: number, segments: Seg[], activeStyle: Style) {
  const t = clamp(mediaTime, 0, duration)
  const seg = segments.find((item) => t >= item.start && t <= item.end)
  ctx.drawImage(video, 0, 0, W, H)
  if (!seg) return

  const s = activeStyle
  const direction = s.direction || 'rtl'
  const align = s.align || 'center'
  const maxSubtitleWidth = W * 0.88
  const maxSubtitleHeight = H * 0.35
  const anchorX = s.x != null ? (Number(s.x) / 100) * W : W / 2
  const anchorY = s.y != null ? (Number(s.y) / 100) * H : H * 0.78
  const fontFamily = s.fontId || s.fontFamily || 'Vazirmatn'
  const baseFontSize = s.size ? (Number(s.size) / 100) * W : W * 0.052

  const fitted = fitSubtitle(ctx, seg.text, baseFontSize, maxSubtitleWidth, maxSubtitleHeight, fontFamily)
  const finalFontSize = fitted.fontSize
  const lines = fitted.lines
  const lineHeight = fitted.lineHeight

  ctx.save()
  ctx.direction = direction
  ctx.globalAlpha = 1

  const bgOpacity = s.bgOpacity ?? 0.6
  if (seg.hl || bgOpacity > 0) {
    const padX = finalFontSize * 0.6
    const padY = finalFontSize * 0.3
    const boxW = fitted.maxLineWidth + padX * 2
    const boxH = fitted.totalHeight + padY * 2
    const boxX = anchorX - boxW / 2
    const boxY = anchorY - boxH / 2
    const radius = s.bgRadius ?? 10
    ctx.save()
    ctx.fillStyle = seg.hl || `rgba(0, 0, 0, ${bgOpacity})`
    ctx.beginPath()
    if (ctx.roundRect) { ctx.roundRect(boxX, boxY, boxW, boxH, radius) } else { ctx.rect(boxX, boxY, boxW, boxH) }
    ctx.fill()
    ctx.restore()
  }

  ctx.font = `${s.bold ? '800' : '400'} ${finalFontSize}px "${fontFamily}", sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = align
  const strokeWidth = Math.max(4, finalFontSize * 0.16)

  if (!s.karaoke || !seg.words || !seg.words.length) {
    lines.forEach((line, index) => {
      const y = anchorY + (index - (lines.length - 1) / 2) * lineHeight
      ctx.shadowColor = s.textShadowColor || 'rgba(0, 0, 0, 0.85)'
      ctx.shadowBlur = s.textShadowBlur ?? Math.max(6, finalFontSize * 0.2)
      if (s.outline) { ctx.strokeStyle = '#000000'; ctx.lineWidth = strokeWidth; ctx.strokeText(line, anchorX, y) }
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0
      ctx.fillStyle = s.color || '#FFFFFF'
      ctx.fillText(line, anchorX, y)
    })
  } else {
    const activeWordIndex = seg.words.findIndex((w) => t >= w.start && t <= w.end)
    const spaceWidth = ctx.measureText(' ').width
    let currentWordIndex = 0
    lines.forEach((line, index) => {
      const y = anchorY + (index - (lines.length - 1) / 2) * lineHeight
      const lineWords = line.split(/\s+/).filter(Boolean)
      const lineWidth = ctx.measureText(line).width
      let cursorOffset = 0
      lineWords.forEach((word) => {
        const wordWidth = ctx.measureText(word).width
        const isWordActive = currentWordIndex === activeWordIndex
        let wordX = anchorX
        if (direction === 'rtl') { wordX = (anchorX + lineWidth / 2) - cursorOffset - (wordWidth / 2) }
        else { wordX = (anchorX - lineWidth / 2) + cursorOffset + (wordWidth / 2) }
        const prevAlign = ctx.textAlign
        ctx.textAlign = 'center'
        ctx.shadowColor = s.textShadowColor || 'rgba(0, 0, 0, 0.85)'
        ctx.shadowBlur = s.textShadowBlur ?? Math.max(6, finalFontSize * 0.2)
        if (s.outline) { ctx.strokeStyle = '#000000'; ctx.lineWidth = strokeWidth; ctx.strokeText(word, wordX, y) }
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0
        ctx.fillStyle = isWordActive ? (s.hlColor || '#FFD600') : (s.color || '#FFFFFF')
        ctx.fillText(word, wordX, y)
        ctx.textAlign = prevAlign
        cursorOffset += wordWidth + spaceWidth
        currentWordIndex++
      })
    })
  }
  ctx.restore()
}

export default function SubtitleVideoExport({ videoUrl, sourceFile, segments, setSegments, style, baseName }: Props) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stageText, setStageText] = useState('')
  const [activeTab, setActiveTab] = useState<ActiveTab>('canvas')
  const [translating, setTranslating] = useState(false)
  const [captionText, setCaptionText] = useState('')
  const [captionHashtags, setCaptionHashtags] = useState('')
  const [volume, setVolume] = useState(100)
  const cancelRef = useRef(false)

  const translateSubtitles = async (targetLang: 'fa' | 'en') => {
    if (!segments.length || translating) return
    setTranslating(true)
    try {
      const pad = (n: number, z = 2) => String(Math.floor(n)).padStart(z, '0')
      const fmtTime = (sec: number) => {
        const s = Math.max(0, Number(sec) || 0)
        return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)},${pad((s % 1) * 1000, 3)}`
      }
      const srt = segments.map((s, i) => `${i + 1}\n${fmtTime(s.start)} --> ${fmtTime(s.end)}\n${s.text}`).join('\n\n')
      const res = await fetch('/api/translate-srt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ srtContent: srt, targetLang }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'خطا')
      if (data.srt) {
        const blocks = data.srt.trim().replace(/\r\n/g, '\n').split(/\n\s*\n/)
        const parsedTexts: string[] = []
        for (const block of blocks) {
          const lines = block.trim().split('\n')
          if (lines.length >= 3) parsedTexts.push(lines.slice(2).join(' ').trim())
        }
        const updated = segments.map((seg, idx) => ({ ...seg, text: parsedTexts[idx] || seg.text }))
        setSegments(updated)
      }
    } catch (e: any) {
      alert('خطا در ترجمه: ' + (e.message || 'نامشخص'))
    } finally { setTranslating(false) }
  }

  const generateCaption = async () => {
    if (!segments.length) return
    try {
      const fullText = segments.map(s => s.text).join(' ')
      const res = await fetch('/api/generate-caption', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullText }),
      })
      const data = await res.json()
      if (data.caption) setCaptionText(data.caption)
      if (data.hashtags) setCaptionHashtags(data.hashtags)
    } catch (e) {
      alert('خطا در تولید کپشن')
    }
  }

  const updateSeg = (i: number, patch: Partial<Seg>) => {
    setSegments(segments.map((s, idx) => idx !== i ? s : { ...s, ...patch }))
  }
  const splitSeg = (i: number) => {
    const s = segments[i]
    const toks = s.text.split(/\s+/)
    if (toks.length < 2) return
    const half = Math.ceil(toks.length / 2)
    const mid = s.start + (s.end - s.start) * (half / toks.length)
    const a: Seg = { ...s, text: toks.slice(0, half).join(' '), start: s.start, end: mid }
    const b: Seg = { ...s, text: toks.slice(half).join(' '), start: mid, end: s.end }
    setSegments([...segments.slice(0, i), a, b, ...segments.slice(i + 1)])
  }
  const mergeSeg = (i: number) => {
    if (i >= segments.length - 1) return
    const a = segments[i], b = segments[i + 1]
    const m: Seg = { ...a, text: a.text + ' ' + b.text, end: b.end }
    setSegments([...segments.slice(0, i), m, ...segments.slice(i + 2)])
  }

  const handleExport = async () => {
    if (!videoUrl || exporting) return
    setExporting(true)
    setProgress(0)
    setStageText('۱. آماده‌سازی...')
    cancelRef.current = false

    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;'
    const video = document.createElement('video')
    video.src = videoUrl
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.muted = true
    container.appendChild(video)
    document.body.appendChild(container)

    try {
      await new Promise<void>((res, rej) => {
        const timeout = setTimeout(() => rej(new Error('Video load timeout')), 10000)
        video.onloadedmetadata = () => { clearTimeout(timeout); res() }
        video.onerror = () => { clearTimeout(timeout); rej(new Error('Video load error')) }
      })

      const duration = video.duration || segments.reduce((max, s) => Math.max(max, s.end), 0)
      const W = video.videoWidth || 1080
      const H = video.videoHeight || 1920

      const canvas = document.createElement('canvas')
      canvas.width = W; canvas.height = H
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })!
      const stream = canvas.captureStream(30)

      const mime = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') ? 'video/webm; codecs=vp9' : 'video/webm'
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 15_000_000 })
      const chunks: Blob[] = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      const recorderPromise = new Promise<void>(resolve => { recorder.onstop = () => resolve() })

      recorder.start(250)
      video.currentTime = 0
      await video.play()

      setStageText('۲. رندر فریم‌ها...')
      await new Promise<void>(resolve => {
        const startTime = Date.now()
        const maxTime = duration * 1000 + 5000
        const onFrame = (_: number, meta: { mediaTime: number }) => {
          if (cancelRef.current || meta.mediaTime >= duration || (Date.now() - startTime) > maxTime) { resolve(); return }
          drawSubtitleOnCanvas(ctx, video, W, H, meta.mediaTime, duration, segments, style)
          const pct = Math.min(50, Math.round((meta.mediaTime / duration) * 50))
          setProgress(pct)
          setStageText(`رندر... (${Math.ceil(duration - meta.mediaTime)}s باقی‌مانده)`)
          if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(onFrame)
        }
        if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(onFrame)
        else {
          const timer = setInterval(() => {
            if (cancelRef.current || video.currentTime >= duration || (Date.now() - startTime) > maxTime) { clearInterval(timer); resolve(); return }
            drawSubtitleOnCanvas(ctx, video, video.currentTime, W, H, duration, segments, style)
            const pct = Math.min(50, Math.round((video.currentTime / duration) * 50))
            setProgress(pct)
          }, 33)
        }
      })

      if (cancelRef.current) throw new Error('CANCELLED')
      recorder.stop(); video.pause()
      await recorderPromise
      if (cancelRef.current) throw new Error('CANCELLED')

      setStageText('۳. فشرده‌سازی با FFmpeg...')
      setProgress(55)

      let finalBlob: Blob
      let useFFmpeg = true

      try {
        const { loadFFmpeg } = await import('@/lib/video-extract')
        const ff = await Promise.race([
          loadFFmpeg(),
          new Promise<any>((_, rej) => setTimeout(() => rej(new Error('FFmpeg timeout')), 15000))
        ])

        const rawBlob = new Blob(chunks, { type: mime })
        const rawName = `raw_${Date.now()}.webm`
        const outName = `final_${Date.now()}.mp4`
        await ff.writeFile(rawName, new Uint8Array(await rawBlob.arrayBuffer()))

        const args = ['-i', rawName, '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast']
        if (sourceFile) {
          const ext = sourceFile.name.match(/\.[^.]+$/)?.[0] || '.mp4'
          const srcName = `src_${Date.now()}${ext}`
          await ff.writeFile(srcName, new Uint8Array(await sourceFile.arrayBuffer()))
          args.push('-i', srcName, '-c:a', 'aac', '-b:a', '192k', '-map', '0:v:0', '-map', '1:a:0?', '-shortest')
        } else { args.push('-c:a', 'aac', '-b:a', '192k') }
        args.push(outName)

        await Promise.race([ff.exec(args), new Promise((_, rej) => setTimeout(() => rej(new Error('FFmpeg exec timeout')), 60000))])
        const data = await ff.readFile(outName)
        try { await ff.deleteFile(rawName); await ff.deleteFile(outName) } catch {}
        finalBlob = new Blob([data], { type: 'video/mp4' })
      } catch (err) {
        console.warn('[Export] FFmpeg failed, using WebM fallback:', err)
        useFFmpeg = false
        finalBlob = new Blob(chunks, { type: mime })
        setStageText('⚠️ FFmpeg لود نشد - خروجی WebM')
      }

      if (cancelRef.current) throw new Error('CANCELLED')
      setProgress(100)
      setStageText('✅ آماده دانلود!')

      const url = URL.createObjectURL(finalBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${baseName}_subtitled.${useFFmpeg ? 'mp4' : 'webm'}`
      document.body.appendChild(a); a.click()
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 5000)

    } catch (err: any) {
      console.error('[Export] Error:', err)
      if (err.message !== 'CANCELLED') alert('❌ خطا: ' + err.message)
    } finally {
      if (document.body.contains(container)) document.body.removeChild(container)
      setExporting(false); setStageText('')
    }
  }

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-zinc-900/80 p-1 text-xs">
        {([
          { id: 'canvas', label: '🖼️ کادر' },
          { id: 'style', label: ' استایل' },
          { id: 'text', label: '🔤 متن' },
          { id: 'audio', label: ' صدا' },
          { id: 'caption', label: '📝 کپشن' },
          { id: 'translate', label: ' ترجمه' },
        ] as { id: ActiveTab; label: string }[]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-2.5 py-1 transition whitespace-nowrap ${activeTab === tab.id ? 'bg-amber-500 font-bold text-black' : 'text-white/70 hover:bg-white/5'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'canvas' && (
        <div className="rounded-xl border border-white/10 bg-zinc-900/90 p-3 text-xs flex flex-wrap items-center gap-3">
          <span className="text-white/60 font-bold">نسبت کادر:</span>
          {(['original', '9:16', '1:1', '16:9', '4:5'] as const).map((ratio) => (
            <button key={ratio} className="rounded-lg px-3 py-1.5 bg-white/5 text-white/70 hover:bg-white/10 transition">
              {ratio === 'original' ? 'اصلی' : ratio}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'style' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl border border-white/10 bg-zinc-900/90 p-3 text-xs">
          <div><div className="mb-1 text-white/40">رنگ متن</div><input type="color" value={style.color} onChange={(e) => {}} className="h-7 w-full rounded-lg border border-white/10 bg-transparent p-0" /></div>
          <div><div className="mb-1 text-white/40">رنگ هایلایت</div><input type="color" value={style.hlColor} onChange={(e) => {}} className="h-7 w-full rounded-lg border border-white/10 bg-transparent p-0" /></div>
          <div><div className="mb-1 text-white/40">پس‌زمینه: {Math.round(style.bgOpacity * 100)}٪</div><input type="range" min={0} max={100} value={Math.round(style.bgOpacity * 100)} onChange={(e) => {}} className="w-full accent-amber-500" /></div>
          <div><div className="mb-1 text-white/40">سایه: {style.textShadowBlur ?? 4}</div><input type="range" min={0} max={15} value={style.textShadowBlur ?? 4} onChange={(e) => {}} className="w-full accent-amber-500" /></div>
          <div><div className="mb-1 text-white/40">حاشیه</div><button className={`w-full py-1.5 rounded-lg transition ${style.outline ? 'bg-amber-500 font-bold text-black' : 'bg-white/5 text-white/50'}`}>{style.outline ? 'روشن' : 'خاموش'}</button></div>
          <div><div className="mb-1 text-white/40">کارائوکه</div><button className={`w-full py-1.5 rounded-lg transition ${style.karaoke ? 'bg-amber-500 font-bold text-black' : 'bg-white/5 text-white/50'}`}>{style.karaoke ? 'روشن' : 'خاموش'}</button></div>
        </div>
      )}

      {activeTab === 'text' && (
        <div className="rounded-xl border border-white/10 bg-zinc-900/90 p-3 text-xs flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button className={`px-3 py-1 rounded-md font-bold transition ${style.bold ? 'bg-amber-500 text-black' : 'bg-white/5 text-white/70'}`}>B</button>
            <button className={`px-3 py-1 rounded-md italic transition ${style.italic ? 'bg-amber-500 text-black' : 'bg-white/5 text-white/70'}`}>I</button>
            <button className={`px-3 py-1 rounded-md underline transition ${style.underline ? 'bg-amber-500 text-black' : 'bg-white/5 text-white/70'}`}>U</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/50">فونت:</span>
            <select value={style.fontId} className="rounded-lg border border-white/10 bg-black/50 p-1.5 text-white/80">
              {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/50">اندازه: {style.size}٪</span>
            <input type="range" min={1} max={20} step={0.5} value={style.size} className="w-24 accent-amber-500" />
          </div>
        </div>
      )}

      {activeTab === 'audio' && (
        <div className="flex flex-wrap items-center gap-6 rounded-xl border border-white/10 bg-zinc-900/90 p-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-white/60">حجم صدا:</span>
            <input type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-28 accent-amber-500" />
            <span className="font-mono text-white/80">{volume}%</span>
          </div>
        </div>
      )}

      {activeTab === 'caption' && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-zinc-900/90 p-3 text-xs">
          <button onClick={generateCaption} className="w-full rounded-lg bg-amber-500 py-2 font-bold text-black hover:bg-amber-400">🤖 تولید کپشن هوشمند با AI</button>
          <div><div className="mb-1 text-white/40">متن کپشن:</div><textarea value={captionText} onChange={(e) => setCaptionText(e.target.value)} rows={4} className="w-full rounded-lg border border-white/10 bg-black/50 p-2 text-white/80" /></div>
          <div><div className="mb-1 text-white/40">هشتگ‌ها:</div><textarea value={captionHashtags} onChange={(e) => setCaptionHashtags(e.target.value)} rows={2} className="w-full rounded-lg border border-white/10 bg-black/50 p-2 text-white/80" /></div>
          <button onClick={() => { navigator.clipboard.writeText(captionText + '\n\n' + captionHashtags); alert('کپی شد!') }} className="w-full rounded-lg bg-white/10 py-2 text-white/80 hover:bg-white/20">📋 کپی کپشن کامل</button>
        </div>
      )}

      {activeTab === 'translate' && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-zinc-900/90 p-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => translateSubtitles('fa')} disabled={translating} className="rounded-lg bg-amber-500 py-2 font-bold text-black hover:bg-amber-400 disabled:opacity-50">🇬🇧 انگلیسی → فارسی</button>
            <button onClick={() => translateSubtitles('en')} disabled={translating} className="rounded-lg bg-white/10 py-2 text-white/80 hover:bg-white/20 disabled:opacity-50">🇮 فارسی → انگلیسی</button>
          </div>
          {translating && <div className="text-center text-amber-400">در حال ترجمه...</div>}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3 text-xs">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-bold text-white/70">کپشن‌ها ({segments.length})</span>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {segments.map((s, i) => (
            <div key={i} className="rounded-lg p-2 bg-white/5 hover:bg-white/10 transition">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[10px] text-white/40">{fmt(s.start)} - {fmt(s.end)}</span>
                <div className="ms-auto flex gap-1">
                  <button onClick={() => splitSeg(i)} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] hover:bg-white/20">✂️</button>
                  <button onClick={() => mergeSeg(i)} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] hover:bg-white/20">🔗</button>
                  <button onClick={() => setSegments(segments.filter((_, idx) => idx !== i))} className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-red-500/30">✕</button>
                </div>
              </div>
              <input value={s.text} onChange={(e) => updateSeg(i, { text: e.target.value })} className="w-full rounded bg-black/40 px-2 py-1 text-white/90 outline-none" />
            </div>
          ))}
        </div>
      </div>

      {exporting ? (
        <div className="bg-stone-900/80 border border-amber-500/40 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-amber-400">{stageText}</span>
            <button onClick={() => { cancelRef.current = true; setExporting(false); setStageText('') }} className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded hover:bg-red-500/20">توقف</button>
          </div>
          <div className="h-2 w-full bg-stone-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-[10px] text-stone-400 text-center">{progress}%</div>
        </div>
      ) : (
        <button onClick={handleExport} className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold text-sm shadow-lg shadow-orange-500/20 hover:from-orange-400 active:scale-95 transition">
          🎬 شروع ساخت ویدیو (MP4/WebM)
        </button>
      )}
    </div>
  )
}
