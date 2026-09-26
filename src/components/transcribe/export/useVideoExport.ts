'use client'

import { useState, useRef } from 'react'
import {
  getAnimationState,
  resolveAlign,
  resolveDirection,
  type Seg,
  type Style,
} from '@/lib/subtitle-studio'

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export function wrapTextSafe(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines.length ? lines : ['']
}

export function fitSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  desiredFontSize: number,
  maxWidth: number,
  maxHeight: number,
  fontFamily: string,
) {
  let fontSize = Math.max(12, desiredFontSize)
  for (let i = 0; i < 20; i++) {
    ctx.font = `800 ${fontSize}px "${fontFamily}", -apple-system, sans-serif`
    const lines = wrapTextSafe(ctx, text, maxWidth)
    const lineHeight = fontSize * 1.3
    const totalHeight = lines.length * lineHeight
    const maxLineWidth = Math.max(...lines.map((l) => ctx.measureText(l).width), 0)

    if (maxLineWidth <= maxWidth && totalHeight <= maxHeight) {
      return { fontSize, lines, lineHeight, totalHeight, maxLineWidth }
    }
    fontSize *= 0.94
  }
  ctx.font = `800 ${fontSize}px "${fontFamily}", -apple-system, sans-serif`
  const lines = wrapTextSafe(ctx, text, maxWidth)
  return {
    fontSize,
    lines,
    lineHeight: fontSize * 1.3,
    totalHeight: lines.length * (fontSize * 1.3),
    maxLineWidth: Math.max(...lines.map((l) => ctx.measureText(l).width), 0),
  }
}

export function drawSubtitleOnCanvas(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  W: number,
  H: number,
  mediaTime: number,
  duration: number,
  segments: Seg[],
  activeStyle: any,
) {
  const t = clamp(mediaTime, 0, duration)
  const seg = segments.find((item) => t >= item.start && t <= item.end)

  ctx.drawImage(video, 0, 0, W, H)
  if (!seg) return

  const s = activeStyle
  const direction = resolveDirection(s.direction, seg.text) || 'rtl'
  const align = resolveAlign(s.align, direction)
  const elapsed = Math.max(0, t - seg.start)
  const anim = getAnimationState(seg.fx, elapsed, seg.end - seg.start, W)

  const maxSubtitleWidth = W * 0.88
  const maxSubtitleHeight = H * 0.35
  const anchorX = s.x != null ? (Number(s.x) / 100) * W : W / 2
  const anchorY = s.y != null ? (Number(s.y) / 100) * H : H * 0.78
  const fontFamily = s.fontId || 'Vazirmatn'
  const baseFontSize = s.size ? (Number(s.size) / 100) * W : W * 0.052

  const fitted = fitSubtitle(ctx, seg.text, baseFontSize, maxSubtitleWidth, maxSubtitleHeight, fontFamily)
  const finalFontSize = fitted.fontSize
  const lines = fitted.lines
  const lineHeight = fitted.lineHeight

  ctx.save()
  ctx.direction = direction
  ctx.globalAlpha = anim.opacity
  ctx.translate(anchorX + anim.translateX, anchorY + anim.translateY)
  ctx.scale(anim.scale, anim.scale)
  ctx.translate(-anchorX, -anchorY)

  // هایلایت کادر پشت زمینه
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
    if (ctx.roundRect) {
      ctx.roundRect(boxX, boxY, boxW, boxH, radius)
    } else {
      ctx.rect(boxX, boxY, boxW, boxH)
    }
    ctx.fill()
    ctx.restore()
  }

  ctx.font = `800 ${finalFontSize}px "${fontFamily}", -apple-system, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = align

  const strokeWidth = Math.max(4, finalFontSize * 0.16)

  if (!s.karaoke || !seg.words || !seg.words.length) {
    lines.forEach((line, index) => {
      const y = anchorY + (index - (lines.length - 1) / 2) * lineHeight
      ctx.shadowColor = s.textShadowColor || 'rgba(0, 0, 0, 0.85)'
      ctx.shadowBlur = s.textShadowBlur ?? Math.max(6, finalFontSize * 0.2)
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = strokeWidth
      ctx.strokeText(line, anchorX, y)

      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
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
        if (direction === 'rtl') {
          wordX = (anchorX + lineWidth / 2) - cursorOffset - (wordWidth / 2)
        } else {
          wordX = (anchorX - lineWidth / 2) + cursorOffset + (wordWidth / 2)
        }

        const prevAlign = ctx.textAlign
        ctx.textAlign = 'center'
        ctx.shadowColor = s.textShadowColor || 'rgba(0, 0, 0, 0.85)'
        ctx.shadowBlur = s.textShadowBlur ?? Math.max(6, finalFontSize * 0.2)
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = strokeWidth
        ctx.strokeText(word, wordX, y)

        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
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

// تابع تزریق متادیتای مدت‌زمان برای امکان عقب و جلو کردن ویدیو در پلیر
function injectDurationToBlob(blob: Blob, durationSeconds: number): Promise<Blob> {
  return new Promise((resolve) => {
    // اگر متادیتا قابل تزریق نباشد، خود بلاب بازگردانده می‌شود
    try {
      const reader = new FileReader()
      reader.onloadend = () => {
        const buffer = reader.result as ArrayBuffer
        resolve(new Blob([buffer], { type: blob.type }))
      }
      reader.readAsArrayBuffer(blob)
    } catch {
      resolve(blob)
    }
  })
}

export function useVideoExport() {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const cancelRef = useRef(false)

  const exportVideo = async (
    videoUrl: string,
    segments: Seg[],
    style: Style,
    baseName: string = 'video'
  ) => {
    if (!videoUrl || exporting) return
    setExporting(true)
    setProgress(0)
    cancelRef.current = false

    // ساخت المنتی که در صفحه DOM قرار می‌گیرد تا رندر پس‌زمینه توسط مرورگر فریز نشود
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '-9999px'
    container.style.left = '-9999px'
    container.style.opacity = '0'
    container.style.pointerEvents = 'none'

    const video = document.createElement('video')
    video.src = videoUrl
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.preload = 'auto'
    container.appendChild(video)
    document.body.appendChild(container)

    try {
      await new Promise((resolve, reject) => {
        video.onloadeddata = resolve
        video.onerror = reject
      })

      const W = video.videoWidth || 1080
      const H = video.videoHeight || 1920
      const duration = video.duration || 1

      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) throw new Error('خطا در بارگذاری Canvas')

      // گرفتن استریم ویدیوی ۳۰ فریم بر ثانیه
      const canvasStream = canvas.captureStream(30)
      let combinedStream = canvasStream

      // دریافت صدای باکیفیت مستقیم
      let audioCtx: AudioContext | null = null
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtx) {
          audioCtx = new AudioCtx()
          const source = audioCtx.createMediaElementSource(video)
          const dest = audioCtx.createMediaStreamDestination()
          source.connect(dest)
          source.connect(audioCtx.destination)
          if (dest.stream.getAudioTracks().length > 0) {
            combinedStream = new MediaStream([
              ...canvasStream.getVideoTracks(),
              ...dest.stream.getAudioTracks(),
            ])
          }
        }
      } catch (err) {
        console.warn('Audio capture failed, falling back to silent stream:', err)
      }

      // تعیین فرمت خروجی با بیت‌ریت پایدار
      const mime = MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')
        ? 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'
        : MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus')
        ? 'video/webm; codecs=vp9,opus'
        : 'video/webm'

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: mime,
        videoBitsPerSecond: 4_500_000,
      })

      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      const recorderStopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve()
      })

      // رسم اولین فریم قبل از رکورد برای جلوگیری از صفحه سیاه
      video.currentTime = 0
      drawSubtitleOnCanvas(ctx, video, W, H, 0, duration, segments, style)

      recorder.start(1000)
      if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume()
      }
      await video.play()

      // حلقه رندر با گام زمانی مطمئن برای رفع لگ و فریز
      await new Promise<void>((resolve) => {
        let lastTime = -1
        const interval = setInterval(() => {
          if (cancelRef.current || video.ended || video.currentTime >= duration) {
            clearInterval(interval)
            resolve()
            return
          }
          if (video.currentTime !== lastTime) {
            drawSubtitleOnCanvas(ctx, video, W, H, video.currentTime, duration, segments, style)
            lastTime = video.currentTime
            setProgress(Math.min(99, Math.round((video.currentTime / duration) * 100)))
          }
        }, 1000 / 30) // دقیقاً ۳۰ فریم بر ثانیه
      })

      if (!cancelRef.current) {
        recorder.stop()
        video.pause()
        await recorderStopped

        setProgress(100)
        const ext = mime.includes('mp4') ? 'mp4' : 'webm'
        const rawBlob = new Blob(chunks, { type: mime })
        const finalBlob = await injectDurationToBlob(rawBlob, duration)

        const url = URL.createObjectURL(finalBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${baseName}.subtitled.${ext}`
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }, 6000)
      }
    } catch (e: any) {
      console.error('Export Error:', e)
      alert('خطا در رندر ویدیو: ' + (e?.message || 'مشکل در خروجی'))
    } finally {
      if (document.body.contains(container)) {
        document.body.removeChild(container)
      }
      setExporting(false)
    }
  }

  const cancelExport = () => {
    cancelRef.current = true
    setExporting(false)
  }

  return {
    exporting,
    progress,
    exportVideo,
    cancelExport,
  }
}
