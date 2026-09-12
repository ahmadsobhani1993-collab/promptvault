'use client'

import { useRef, useState } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import {
  DEFAULT_STYLE,
  getAnimationState,
  loadFont,
  resolveAlign,
  resolveDirection,
  type Seg,
  type Style,
  type TextAlign,
  type TextDirection,
} from '@/lib/subtitle-studio'

type Props = {
  videoUrl: string
  baseName: string
  segments: Seg[]
  style?: Style
}

const STYLE_STORAGE_KEY = 'promptvault.subtitle.style'
const FPS = 30
const WEBM_BITRATE = 4_000_000

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

function readStoredStyle(): Partial<Style> | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(STYLE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function wrapTextSafe(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ['']

  const lines: string[] = []
  let line = ''

  const pushBrokenWord = (word: string) => {
    let part = ''
    for (const ch of word) {
      const test = part + ch
      if (part && ctx.measureText(test).width > maxWidth) {
        lines.push(part)
        part = ch
      } else {
        part = test
      }
    }
    if (part) line = part
  }

  for (const word of words) {
    if (ctx.measureText(word).width > maxWidth) {
      if (line) {
        lines.push(line)
        line = ''
      }
      pushBrokenWord(word)
      continue
    }

    const test = line ? `${line} ${word}` : word
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }

  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function fitSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  desiredFontSize: number,
  maxWidth: number,
  maxHeight: number,
  fontFamily: string
) {
  let fontSize = Math.max(1, desiredFontSize)

  for (let i = 0; i < 30; i++) {
    ctx.font = `700 ${fontSize}px "${fontFamily}"`
    const lines = wrapTextSafe(ctx, text, Math.max(1, maxWidth))
    const lineHeight = fontSize * 1.25
    const totalHeight = lines.length * lineHeight
    const maxLineWidth = Math.max(...lines.map((line) => ctx.measureText(line).width), 0)
    const padding = Math.max(2, fontSize * 0.6)

    if (
      maxLineWidth + padding <= maxWidth &&
      totalHeight + padding <= maxHeight
    ) {
      return { fontSize, lines, lineHeight, totalHeight, maxLineWidth, padding }
    }

    fontSize *= 0.92
  }

  ctx.font = `700 ${fontSize}px "${fontFamily}"`
  const lines = wrapTextSafe(ctx, text, Math.max(1, maxWidth))
  const lineHeight = fontSize * 1.25
  const totalHeight = lines.length * lineHeight
  const maxLineWidth = Math.max(...lines.map((line) => ctx.measureText(line).width), 0)
  const padding = Math.max(2, fontSize * 0.6)

  return { fontSize, lines, lineHeight, totalHeight, maxLineWidth, padding }
}

function waitForSeek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      resolve()
    }
    const onSeeked = () => finish()
    const onError = () => {
      if (done) return
      done = true
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      reject(new Error('جابجایی فریم ویدیو شکست خورد'))
    }
    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.currentTime = time
    window.setTimeout(finish, 1200)
  })
}

export default function SubtitleVideoExport({
  videoUrl,
  baseName,
  segments,
  style,
}: Props) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const currentStyle = style || DEFAULT_STYLE
  const styleRef = useRef(currentStyle)
  styleRef.current = currentStyle
  const segRef = useRef(segments)
  segRef.current = segments

  const exportVideo = async () => {
    if (exporting || !videoUrl) return

    setExporting(true)
    setProgress(0)
    setStatus('در حال آماده سازی...')

    let video: HTMLVideoElement | null = null
    let audioCtx: AudioContext | null = null
    let ffmpeg: FFmpeg | null = null
    let recorder: MediaRecorder | null = null
    let stream: MediaStream | null = null

    try {
      const storedStyle = readStoredStyle()
      const exportStyle: Style = {
        ...DEFAULT_STYLE,
        ...(storedStyle || {}),
        ...(style || {}),
      }
      styleRef.current = exportStyle

      video = document.createElement('video')
      video.src = videoUrl
      video.playsInline = true
      video.preload = 'auto'
      video.muted = true
      video.crossOrigin = 'anonymous'
      video.style.position = 'fixed'
      video.style.left = '-10000px'
      video.style.top = '-10000px'
      video.style.width = '1px'
      video.style.height = '1px'
      document.body.appendChild(video)

      await new Promise<void>((resolve, reject) => {
        let settled = false
        const finish = (fn: () => void) => {
          if (settled) return
          settled = true
          fn()
        }
        video!.onloadedmetadata = () => finish(resolve)
        video!.onerror = () => finish(() => reject(new Error('لود ویدیو شکست خورد')))
        window.setTimeout(() => finish(() => reject(new Error('تایم‌اوت لود ویدیو'))), 20_000)
        video!.load()
      })

      const W = video.videoWidth
      const H = video.videoHeight
      const duration = Number.isFinite(video.duration) ? video.duration : 0

      if (!W || !H || !duration) {
        throw new Error('ابعاد یا مدت ویدیو معتبر نیست')
      }

      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) throw new Error('Canvas در این مرورگر در دسترس نیست')

      setStatus('در حال آماده سازی فونت...')
      await loadFont(exportStyle.fontId || 'Vazirmatn')
      try { await document.fonts.ready } catch {}

      setStatus('در حال آماده سازی فریم‌ها...')

      stream = canvas.captureStream(FPS)

      try {
        audioCtx = new AudioContext()
        const source = audioCtx.createMediaElementSource(video)
        const destination = audioCtx.createMediaStreamDestination()
        source.connect(destination)
        destination.stream.getAudioTracks().forEach((track) => stream!.addTrack(track))
        if (audioCtx.state === 'suspended') await audioCtx.resume()
      } catch (error) {
        console.warn('[Export] Audio capture unavailable:', error)
      }

      const mimeCandidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ]
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm'

      recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: WEBM_BITRATE,
      })

      const chunks: Blob[] = []
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data)
      }

      const recorderStopped = new Promise<void>((resolve) => {
        recorder!.onstop = () => resolve()
      })

      const renderFrame = (mediaTime: number) => {
        const t = clamp(mediaTime, 0, duration)
        const seg = segRef.current.find((item) => t >= item.start && t <= item.end)

        ctx.clearRect(0, 0, W, H)
        ctx.drawImage(video!, 0, 0, W, H)

        if (!seg) return

        const s = styleRef.current || DEFAULT_STYLE
        const direction = resolveDirection(s.direction, seg.text)
        const align = resolveAlign(s.align, direction)
        const elapsed = Math.max(0, t - seg.start)
        const anim = getAnimationState(seg.fx, elapsed, seg.end - seg.start, W)

        const edgeMargin = Math.max(2, W * 0.01)
        const anchorX = s.x != null ? (Number(s.x) / 100) * W : W / 2
        const anchorY = s.y != null ? (Number(s.y) / 100) * H : H * 0.9
        const availableWidth = Math.max(
          1,
          Math.min(
            W - edgeMargin * 2,
            2 * Math.min(anchorX - edgeMargin, W - anchorX - edgeMargin)
          )
        )
        const availableHeight = Math.max(1, H - edgeMargin * 2)
        const fontFamily = s.fontId || 'Vazirmatn'
        const desiredFontSize = (Number(s.size) / 100) * W * anim.scale

        ctx.save()
        ctx.globalAlpha = anim.opacity
        ctx.translate(anim.translateX, anim.translateY)

        const fitted = fitSubtitle(
          ctx,
          seg.text,
          desiredFontSize,
          availableWidth,
          availableHeight,
          fontFamily
        )

        const finalFontSize = fitted.fontSize
        const lines = fitted.lines
        const lineHeight = fitted.lineHeight
        const totalH = fitted.totalHeight
        const maxLineWidth = fitted.maxLineWidth
        const padding = fitted.padding

        const boxWidth = Math.min(
          W - edgeMargin * 2,
          Math.max(1, Math.min(availableWidth, maxLineWidth + padding))
        )
        const boxHeight = Math.min(
          H - edgeMargin * 2,
          totalH + padding
        )

        const minX = edgeMargin + boxWidth / 2
        const maxX = W - edgeMargin - boxWidth / 2
        const minY = edgeMargin + boxHeight / 2
        const maxY = H - edgeMargin - boxHeight / 2
        const finalX = minX <= maxX ? clamp(anchorX, minX, maxX) : W / 2
        const finalY = minY <= maxY ? clamp(anchorY, minY, maxY) : H / 2

        ctx.font = `700 ${finalFontSize}px "${fontFamily}"`
        ctx.textBaseline = 'middle'
        ctx.textAlign = align
        try { ctx.direction = direction } catch {}

        const bgX = finalX - boxWidth / 2
        const bgY = finalY - boxHeight / 2
        if (s.bgOpacity > 0) {
          ctx.fillStyle = `rgba(0,0,0,${clamp(Number(s.bgOpacity), 0, 1)})`
          ctx.fillRect(bgX, bgY, boxWidth, boxHeight)
        }

        const drawX = align === 'left'
          ? bgX + padding / 2
          : align === 'right'
          ? bgX + boxWidth - padding / 2
          : finalX

        const wordMap = seg.words?.length ? seg.words : []
        let wordCursor = 0

        const drawLine = (line: string, y: number) => {
          if (!s.karaoke || !wordMap.length) {
            if (s.outline) {
              ctx.strokeStyle = '#000'
              ctx.lineWidth = Math.max(2, finalFontSize * 0.08)
              ctx.strokeText(line, drawX, y)
            }
            ctx.fillStyle = s.color
            ctx.fillText(line, drawX, y)
            return
          }

          const lineWords = line.split(/\s+/).filter(Boolean)
          if (!lineWords.length) return

          const pieces = lineWords.map((word) => {
            const match = wordMap.slice(wordCursor).find((w) => w.w === word)
            if (match) wordCursor = wordMap.indexOf(match) + 1
            return { word, timing: match }
          })

          const spaceWidth = ctx.measureText(' ').width
          const widths = pieces.map((p) => ctx.measureText(p.word).width)
          const lineWidth = widths.reduce((a, b) => a + b, 0) + spaceWidth * Math.max(0, widths.length - 1)

          let cursorX = align === 'left'
            ? drawX
            : align === 'right'
            ? drawX - lineWidth
            : drawX - lineWidth / 2

          const visualPieces = direction === 'rtl' ? [...pieces].reverse() : pieces

          for (const piece of visualPieces) {
            const width = ctx.measureText(piece.word).width
            const active = piece.timing && t >= piece.timing.start && t <= piece.timing.end
            const centerX = cursorX + width / 2

            if (s.outline) {
              ctx.strokeStyle = '#000'
              ctx.lineWidth = Math.max(2, finalFontSize * 0.08)
              ctx.strokeText(piece.word, centerX, y)
            }

            ctx.fillStyle = active ? s.hlColor : s.color
            ctx.fillText(piece.word, centerX, y)
            cursorX += direction === 'rtl' ? -(width + spaceWidth) : width + spaceWidth
          }
        }

        lines.forEach((line, index) => {
          const y = finalY + (index - (lines.length - 1) / 2) * lineHeight
          drawLine(line, y)
        })

        ctx.restore()
      }

      let frameCount = 0
      let lastMediaTime = -1
      let rafId: number | null = null
      let stopped = false

      const stopRecording = () => {
        if (stopped) return
        stopped = true
        if (rafId != null) cancelAnimationFrame(rafId)
        if (recorder?.state === 'recording') recorder.stop()
      }

      type RVFCMetadata = { mediaTime: number }
      type RVFCVideo = HTMLVideoElement & {
        requestVideoFrameCallback: (callback: (now: number, metadata: RVFCMetadata) => void) => number
      }
      const rvfcVideo = video as RVFCVideo

      const renderCallback = (_now: number, metadata: RVFCMetadata) => {
        if (stopped) return

        const mediaTime = metadata.mediaTime
        if (mediaTime > lastMediaTime + 0.0001) {
          lastMediaTime = mediaTime
          renderFrame(mediaTime)
          frameCount += 1
          setProgress(clamp((mediaTime / duration) * 70, 0, 70))
        }

        if (mediaTime >= duration - 0.03 || video!.ended) {
          renderFrame(duration)
          setProgress(70)
          stopRecording()
          return
        }

        rvfcVideo.requestVideoFrameCallback(renderCallback)
      }

      const fallbackLoop = () => {
        if (stopped) return
        renderFrame(video!.currentTime)
        frameCount += 1
        setProgress(clamp((video!.currentTime / duration) * 70, 0, 70))
        if (video!.ended || video!.currentTime >= duration - 0.03) {
          renderFrame(duration)
          setProgress(70)
          stopRecording()
          return
        }
        rafId = requestAnimationFrame(fallbackLoop)
      }

      recorder.start(1000)
      setStatus('در حال آماده سازی ویدیو...')
      video.currentTime = 0
      await video.play()

      if ('requestVideoFrameCallback' in video) {
        rvfcVideo.requestVideoFrameCallback(renderCallback)
      } else {
        rafId = requestAnimationFrame(fallbackLoop)
      }

      await recorderStopped

      if (!chunks.length) throw new Error('هیچ داده‌ای ضبط نشد')

      setProgress(70)
      setProgress(0)
      setStatus('در حال تبدیل ویدیو...')

      ffmpeg = new FFmpeg()
      ffmpeg.on('progress', ({ progress: p }) => {
        setProgress(Math.round(clamp(Number(p) || 0, 0, 1) * 100))
      })

      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
      const [coreResponse, wasmResponse] = await Promise.all([
        fetch(`${baseURL}/ffmpeg-core.js`),
        fetch(`${baseURL}/ffmpeg-core.wasm`),
      ])

      if (!coreResponse.ok || !wasmResponse.ok) {
        throw new Error('دریافت موتور FFmpeg شکست خورد')
      }

      const [coreBlob, wasmBlob] = await Promise.all([
        coreResponse.blob(),
        wasmResponse.blob(),
      ])

      const coreURL = URL.createObjectURL(coreBlob)
      const wasmURL = URL.createObjectURL(wasmBlob)

      try {
        await ffmpeg.load({ coreURL, wasmURL })
      } finally {
        URL.revokeObjectURL(coreURL)
        URL.revokeObjectURL(wasmURL)
      }

      const webmBlob = new Blob(chunks, { type: mime })
      await ffmpeg.writeFile('input.webm', new Uint8Array(await webmBlob.arrayBuffer()))

      await ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '22',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        'output.mp4',
      ])

      const mp4Data = await ffmpeg.readFile('output.mp4') as Uint8Array
      const mp4Blob = new Blob([mp4Data], { type: 'video/mp4' })

      setStatus('دانلود...')
      const url = URL.createObjectURL(mp4Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${baseName}.subtitled.mp4`
      document.body.appendChild(a)
      a.click()
      a.remove()

      setProgress(100)
      setStatus('✅ کامل شد!')

      window.setTimeout(() => {
        URL.revokeObjectURL(url)
        ffmpeg?.deleteFile('input.webm').catch(() => {})
        ffmpeg?.deleteFile('output.mp4').catch(() => {})
      }, 5000)

      console.log('[Export] complete:', frameCount, 'frames')
    } catch (error: any) {
      console.error('[Export Error]', error)
      setStatus('❌ خطا')
      alert('❌ خطا: ' + (error?.message || 'Unknown'))
    } finally {
      try { video?.pause() } catch {}
      if (stream) stream.getTracks().forEach((track) => track.stop())
      if (audioCtx) audioCtx.close().catch(() => {})
      if (video?.parentNode) video.parentNode.removeChild(video)
      setExporting(false)
    }
  }

  const safeProgress = clamp(Number(progress) || 0, 0, 100)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 p-4">
      <button
        onClick={exportVideo}
        disabled={exporting}
        className="w-full rounded-xl bg-orange-500 py-4 font-bold text-white transition-all hover:bg-orange-600 disabled:bg-gray-600"
      >
        {exporting ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm">{status}</span>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-700">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-150"
                style={{ width: `${safeProgress}%` }}
              />
            </div>
            <span className="text-xs">{Math.round(safeProgress)}%</span>
          </div>
        ) : (
          '📹 خروجی MP4 با زیرنویس'
        )}
      </button>
    </div>
  )
}
