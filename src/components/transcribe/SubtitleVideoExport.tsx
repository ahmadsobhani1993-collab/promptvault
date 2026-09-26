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
  style: Style
  baseName: string
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

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

export default function SubtitleVideoExport({ videoUrl, sourceFile, segments, style, baseName }: Props) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stageText, setStageText] = useState('')
  const cancelRef = useRef(false)

  const handleExport = async () => {
    if (!videoUrl || exporting) return
    setExporting(true)
    setProgress(0)
    setStageText('. آماده‌سازی...')
    cancelRef.current = false

    console.log('[Export] Starting export...', { videoUrl, segmentsCount: segments.length, baseName })

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
      console.log('[Export] Waiting for video metadata...')
      await new Promise<void>((res, rej) => {
        const timeout = setTimeout(() => rej(new Error('Video load timeout')), 10000)
        video.onloadedmetadata = () => { clearTimeout(timeout); console.log('[Export] Video metadata loaded'); res() }
        video.onerror = () => { clearTimeout(timeout); rej(new Error('Video load error')) }
      })

      const duration = video.duration || segments.reduce((max, s) => Math.max(max, s.end), 0)
      const W = video.videoWidth || 1080
      const H = video.videoHeight || 1920

      console.log('[Export] Video info:', { duration, W, H })

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

      console.log('[Export] Starting canvas render...')
      setStageText('۲. رندر فریم‌ها...')
      
      await new Promise<void>(resolve => {
        const startTime = Date.now()
        const maxTime = duration * 1000 + 5000
        const onFrame = (_: number, meta: { mediaTime: number }) => {
          if (cancelRef.current || meta.mediaTime >= duration || (Date.now() - startTime) > maxTime) { 
            console.log('[Export] Canvas render complete')
            resolve(); return 
          }
          drawSubtitleOnCanvas(ctx, video, W, H, meta.mediaTime, duration, segments, style)
          const pct = Math.min(50, Math.round((meta.mediaTime / duration) * 50))
          setProgress(pct)
          setStageText(`رندر... (${Math.ceil(duration - meta.mediaTime)}s باقی‌مانده)`)
          if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(onFrame)
        }
        if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(onFrame)
        else {
          const timer = setInterval(() => {
            if (cancelRef.current || video.currentTime >= duration || (Date.now() - startTime) > maxTime) { 
              clearInterval(timer); console.log('[Export] Canvas render complete (fallback)')
              resolve(); return 
            }
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

      console.log('[Export] Chunks collected:', chunks.length)
      setStageText('۳. فشرده‌سازی با FFmpeg...')
      setProgress(55)

      let finalBlob: Blob
      let useFFmpeg = true

      try {
        console.log('[Export] Loading FFmpeg...')
        const { loadFFmpeg } = await import('@/lib/video-extract')
        const ff = await Promise.race([
          loadFFmpeg(),
          new Promise<any>((_, rej) => setTimeout(() => { console.warn('[Export] FFmpeg load timeout'); rej(new Error('FFmpeg timeout')) }, 15000))
        ])
        console.log('[Export] FFmpeg loaded successfully')

        const rawBlob = new Blob(chunks, { type: mime })
        const rawName = `raw_${Date.now()}.webm`
        const outName = `final_${Date.now()}.mp4`
        await ff.writeFile(rawName, new Uint8Array(await rawBlob.arrayBuffer()))

        const args = ['-i', rawName, '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast']
        if (sourceFile) {
          console.log('[Export] Using source file for audio')
          const ext = sourceFile.name.match(/\.[^.]+$/)?.[0] || '.mp4'
          const srcName = `src_${Date.now()}${ext}`
          await ff.writeFile(srcName, new Uint8Array(await sourceFile.arrayBuffer()))
          args.push('-i', srcName, '-c:a', 'aac', '-b:a', '192k', '-map', '0:v:0', '-map', '1:a:0?', '-shortest')
        } else { 
          console.warn('[Export] No source file - audio may be missing')
          args.push('-c:a', 'aac', '-b:a', '192k') 
        }
        args.push(outName)

        console.log('[Export] Running FFmpeg with args:', args)
        setProgress(65)
        
        await Promise.race([ff.exec(args), new Promise((_, rej) => setTimeout(() => { console.warn('[Export] FFmpeg exec timeout'); rej(new Error('FFmpeg exec timeout')) }, 60000))])
        
        console.log('[Export] FFmpeg done, reading output...')
        const data = await ff.readFile(outName)
        try { await ff.deleteFile(rawName); await ff.deleteFile(outName) } catch {}
        finalBlob = new Blob([data], { type: 'video/mp4' })
        console.log('[Export] MP4 created, size:', finalBlob.size)
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
      console.error('[Export] Fatal error:', err)
      if (err.message !== 'CANCELLED') alert('❌ خطا: ' + err.message)
    } finally {
      if (document.body.contains(container)) document.body.removeChild(container)
      setExporting(false); setStageText('')
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
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