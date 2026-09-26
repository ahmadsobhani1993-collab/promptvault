'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  getAnimationState,
  resolveAlign,
  resolveDirection,
  type Seg,
  type Style,
} from '@/lib/subtitle-studio'
import { loadFFmpeg } from '@/lib/video-extract'

export type ExportQuality = 'balanced' | 'high'

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

let ffmpegLock: Promise<any> = Promise.resolve()
function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const result = ffmpegLock.then(fn, fn)
  ffmpegLock = result.catch(() => {})
  return result
}

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

async function extractAudioSafe(
  ff: any,
  inputName: string,
  outputName: string,
  limitDuration?: number
): Promise<boolean> {
  const durationArgs = limitDuration ? ['-t', String(limitDuration)] : []
  try {
    await ff.exec(['-i', inputName, '-vn', '-c:a', 'copy', ...durationArgs, outputName])
    return true
  } catch (err) {
    console.warn('[AudioPrep] Stream-copy failed, falling back to AAC:', err)
    try {
      await ff.exec(['-i', inputName, '-vn', '-c:a', 'aac', '-b:a', '192k', ...durationArgs, outputName])
      return true
    } catch (fallbackErr) {
      console.error('[AudioPrep] Audio fallback failed:', fallbackErr)
      return false
    }
  }
}

export function useVideoExport(sourceFile?: File | Blob | null) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stageText, setStageText] = useState('')
  const cancelRef = useRef(false)
  const preppedAudioRef = useRef<{ name: string; ready: boolean } | null>(null)

  const prepAudio = useCallback(async (fileOrBlob: File | Blob) => {
    if (preppedAudioRef.current?.ready) return
    try {
      await runExclusive(async () => {
        const ff = await loadFFmpeg()
        const ext = (fileOrBlob as File)?.name?.match(/\.[^.]+$/)?.[0] || '.mp4'
        const inName = `prep_in_${Date.now()}${ext}`
        const outAudio = `prep_audio_${Date.now()}.m4a`

        await ff.writeFile(inName, new Uint8Array(await fileOrBlob.arrayBuffer()))
        const success = await extractAudioSafe(ff, inName, outAudio)
        await ff.deleteFile(inName)

        if (success) {
          preppedAudioRef.current = { name: outAudio, ready: true }
        }
      })
    } catch (e) {
      console.warn('[Background Audio Prep Warn]', e)
    }
  }, [])

  useEffect(() => {
    if (sourceFile) prepAudio(sourceFile)
    return () => {
      const stale = preppedAudioRef.current
      if (stale?.ready) {
        preppedAudioRef.current = null
        runExclusive(async () => {
          const ff = await loadFFmpeg()
          await ff.deleteFile(stale.name).catch(() => {})
        })
      }
    }
  }, [sourceFile, prepAudio])

  const exportVideo = async (
    videoUrl: string,
    segments: Seg[],
    style: Style,
    baseName: string = 'video',
    quality: ExportQuality = 'balanced'
  ) => {
    if (!videoUrl || exporting) return

    setExporting(true)
    setProgress(0)
    setStageText('آماده‌سازی لایه‌ها...')
    cancelRef.current = false

    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;'

    const video = document.createElement('video')
    video.src = videoUrl
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.preload = 'auto'
    
    // قطع قطعی صدای المنت برای جلوگیری از پخش از اسپیکر
    video.muted = true
    video.volume = 0

    container.appendChild(video)
    document.body.appendChild(container)

    let canvasStream: MediaStream | null = null
    let recorder: MediaRecorder | null = null

    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('خطا در بارگذاری اولیه ویدیو'))
      })

      let duration = video.duration
      if (!duration || !Number.isFinite(duration) || duration <= 0) {
        try {
          video.currentTime = 1e101
          await new Promise<void>((r) => {
            const onTime = () => {
              video.removeEventListener('timeupdate', onTime)
              r()
            }
            video.addEventListener('timeupdate', onTime, { once: true })
            setTimeout(r, 800)
          })
          duration = video.duration
          video.currentTime = 0
        } catch {
          video.currentTime = 0
        }
      }

      if (!duration || !Number.isFinite(duration) || duration <= 0) {
        duration = segments.length > 0 ? Math.max(...segments.map((s) => s.end)) : 10
      }

      let targetFps = 30
      try {
        const probeStream = (video as any).captureStream?.()
        const track = probeStream?.getVideoTracks?.()[0]
        const settings = track?.getSettings?.()
        if (settings?.frameRate && settings.frameRate > 45) {
          targetFps = 60
        }
        track?.stop()
        probeStream?.getTracks().forEach((t: MediaStreamTrack) => t.stop())
      } catch {
        targetFps = 30
      }

      const W = video.videoWidth || 1080
      const H = video.videoHeight || 1920

      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
      if (!ctx) throw new Error('امکان ایجاد Canvas وجود ندارد')

      canvasStream = canvas.captureStream(targetFps)

      const mime = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
        ? 'video/webm; codecs=vp9'
        : MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.640028"')
        ? 'video/mp4; codecs="avc1.640028"'
        : 'video/webm'

      const intermediateBitrate = duration > 120 ? 9_000_000 : 15_000_000

      recorder = new MediaRecorder(canvasStream, {
        mimeType: mime,
        videoBitsPerSecond: intermediateBitrate,
      })

      const rawChunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) rawChunks.push(e.data)
      }

      const recorderStopped = new Promise<void>((resolve) => {
        if (!recorder) return resolve()
        recorder.onstop = () => resolve()
      })

      video.currentTime = 0
      drawSubtitleOnCanvas(ctx, video, W, H, 0, duration, segments, style)

      recorder.start(250)
      await video.play()

      // فاز ۱: رندر فریم‌به‌فریم کانویس تا ۵۰٪
      await new Promise<void>((resolve) => {
        const startTime = Date.now()
        const maxRealTimeMs = (duration + 2) * 1000

        const onFrame = (_now: DOMHighResTimeStamp, metadata: { mediaTime: number }) => {
          if (cancelRef.current || video.ended || metadata.mediaTime >= duration || (Date.now() - startTime) > maxRealTimeMs) {
            resolve()
            return
          }
          drawSubtitleOnCanvas(ctx, video, W, H, metadata.mediaTime, duration, segments, style)
          const p = Math.min(50, Math.round((metadata.mediaTime / duration) * 50))
          setProgress(p)
          
          const remainingSec = Math.max(0, duration - metadata.mediaTime)
          setStageText(`رندر کانویس (${Math.ceil(remainingSec)}s باقی‌مانده)`)

          if ('requestVideoFrameCallback' in video) {
            video.requestVideoFrameCallback(onFrame)
          }
        }

        if ('requestVideoFrameCallback' in video) {
          video.requestVideoFrameCallback(onFrame)
        } else {
          const timer = setInterval(() => {
            if (cancelRef.current || video.ended || video.currentTime >= duration || (Date.now() - startTime) > maxRealTimeMs) {
              clearInterval(timer)
              resolve()
              return
            }
            drawSubtitleOnCanvas(ctx, video, W, H, video.currentTime, duration, segments, style)
            const p = Math.min(50, Math.round((video.currentTime / duration) * 50))
            setProgress(p)
            const remainingSec = Math.max(0, duration - video.currentTime)
            setStageText(`رندر کانویس (${Math.ceil(remainingSec)}s باقی‌مانده)`)
          }, 1000 / targetFps)
        }
      })

      if (cancelRef.current) {
        try { recorder.stop() } catch {}
        video.pause()
        canvasStream.getTracks().forEach((t) => t.stop())
        return
      }

      recorder.stop()
      video.pause()
      await recorderStopped

      if (cancelRef.current) return

      // فاز ۲: استخراج خودکار صدا و فشرده‌سازی با FFmpeg
      setStageText('آماده‌سازی استخراج صدا و ساخت کانتینر...')
      setProgress(55)

      const finalBlob = await runExclusive(async () => {
        const ff = await loadFFmpeg()

        // استخراج مستقیم از videoUrl در صورت غیبت منبع دستی
        let workingSource = sourceFile
        if (!workingSource) {
          try {
            setStageText('دریافت بایت‌های ویدیوی اصلی...')
            const resp = await fetch(videoUrl)
            workingSource = await resp.blob()
          } catch (fetchErr) {
            console.warn('[VideoExport] Fetching videoUrl blob failed:', fetchErr)
          }
        }

        let audioFileToUse = preppedAudioRef.current?.name || null

        if (!audioFileToUse && workingSource) {
          setStageText('استخراج صدای اورجینال...')
          const inExt = (workingSource as File)?.name?.match(/\.[^.]+$/)?.[0] || '.mp4'
          const tmpSrc = `src_late_${Date.now()}${inExt}`
          const tmpOut = `audio_late_${Date.now()}.m4a`

          await ff.writeFile(tmpSrc, new Uint8Array(await workingSource.arrayBuffer()))
          const ok = await extractAudioSafe(ff, tmpSrc, tmpOut, duration)
          await ff.deleteFile(tmpSrc)

          if (ok) {
            audioFileToUse = tmpOut
          }
        }

        setStageText('فشرده‌سازی هوشمند CRF و Muxing...')
        setProgress(65)

        const rawBlob = new Blob(rawChunks, { type: mime })
        const rawVideoName = `raw_${Date.now()}.webm`
        const finalOutputName = `final_${Date.now()}.mp4`

        await ff.writeFile(rawVideoName, new Uint8Array(await rawBlob.arrayBuffer()))

        const audioArgs = audioFileToUse ? ['-i', audioFileToUse, '-c:a', 'copy'] : []
        const crfValue = quality === 'high' ? '20' : '23'
        const presetValue = quality === 'high' ? 'medium' : 'veryfast'

        await ff.exec([
          '-i', rawVideoName,
          ...audioArgs,
          '-c:v', 'libx264',
          '-crf', crfValue,
          '-preset', presetValue,
          '-shortest',
          finalOutputName,
        ])

        setProgress(95)
        const finalData = await ff.readFile(finalOutputName)

        await ff.deleteFile(rawVideoName)
        await ff.deleteFile(finalOutputName)
        if (audioFileToUse && audioFileToUse !== preppedAudioRef.current?.name) {
          await ff.deleteFile(audioFileToUse).catch(() => {})
        }

        return new Blob([finalData], { type: 'video/mp4' })
      })

      if (cancelRef.current) return

      setProgress(100)
      setStageText('آماده دانلود!')

      const url = URL.createObjectURL(finalBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${baseName}.subtitled.mp4`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 5000)

    } catch (e: any) {
      if (!cancelRef.current) {
        console.error('[Export Error]', e)
        alert('خطا در رندر خروجی: ' + (e?.message || 'عملیات ناموفق بود'))
      }
    } finally {
      if (canvasStream) {
        canvasStream.getTracks().forEach((t) => t.stop())
      }
      if (document.body.contains(container)) {
        document.body.removeChild(container)
      }
      setExporting(false)
      setStageText('')
    }
  }

  const cancelExport = () => {
    cancelRef.current = true
    setExporting(false)
    setStageText('')
  }

  return {
    exporting,
    progress,
    stageText,
    exportVideo,
    cancelExport,
  }
}
