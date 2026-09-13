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
} from '@/lib/subtitle-studio'

type Props = {
  videoUrl: string
  baseName: string
  segments: Seg[]
  style?: Style
}

const STYLE_STORAGE_KEY = 'promptvault.subtitle.style'
const FPS = 30
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

let cachedFFmpeg: FFmpeg | null = null

function parseFFmpegTime(timeStr: string): number {
  const parts = timeStr.split(':')
  if (parts.length < 3) return 0
  const h = parseFloat(parts[0]) || 0
  const m = parseFloat(parts[1]) || 0
  const s = parseFloat(parts[2]) || 0
  return h * 3600 + m * 60 + s
}

async function getOrInitFFmpeg(): Promise<FFmpeg> {
  if (cachedFFmpeg && cachedFFmpeg.loaded) return cachedFFmpeg

  const ffmpeg = new FFmpeg()
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
  const [coreResponse, wasmResponse] = await Promise.all([
    fetch(`${baseURL}/ffmpeg-core.js`),
    fetch(`${baseURL}/ffmpeg-core.wasm`),
  ])
  if (!coreResponse.ok || !wasmResponse.ok) throw new Error('دانلود ماژول FFmpeg ناموفق بود')

  const [coreBlob, wasmBlob] = await Promise.all([coreResponse.blob(), wasmResponse.blob()])
  const coreURL = URL.createObjectURL(coreBlob)
  const wasmURL = URL.createObjectURL(wasmBlob)

  try {
    await ffmpeg.load({ coreURL, wasmURL })
  } finally {
    URL.revokeObjectURL(coreURL)
    URL.revokeObjectURL(wasmURL)
  }

  cachedFFmpeg = ffmpeg
  return ffmpeg
}

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

function wrapTextSafe(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

function fitSubtitle(
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

export default function SubtitleVideoExport({ videoUrl, baseName, segments, style }: Props) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [showProgressPercent, setShowProgressPercent] = useState(false)

  const currentStyle = style || DEFAULT_STYLE
  const styleRef = useRef(currentStyle)
  styleRef.current = currentStyle
  const segRef = useRef(segments)
  segRef.current = segments

  const exportVideo = async () => {
    if (exporting || !videoUrl) return
    setExporting(true)
    setProgress(0)
    setShowProgressPercent(false)
    setStatus('در حال آماده‌سازی ویدیو...')

    let video: HTMLVideoElement | null = null
    let audioCtx: AudioContext | null = null
    let recorder: MediaRecorder | null = null
    let stream: MediaStream | null = null

    try {
      const storedStyle = readStoredStyle()
      const exportStyle: Style = { ...DEFAULT_STYLE, ...(storedStyle || {}), ...(style || {}) }
      styleRef.current = exportStyle

      setStatus('در حال آماده‌سازی قلم...')
      await loadFont(exportStyle.fontId || 'Vazirmatn')
      try { await document.fonts.ready } catch {}

      video = document.createElement('video')
      video.src = videoUrl
      video.playsInline = true
      video.preload = 'auto'
      video.crossOrigin = 'anonymous'
      video.muted = false
      video.volume = 1
      video.style.position = 'fixed'
      video.style.left = '-10000px'
      video.style.top = '-10000px'
      video.style.width = '1px'
      video.style.height = '1px'
      document.body.appendChild(video)

      await new Promise<void>((resolve, reject) => {
        let settled = false
        const finish = (fn: () => void) => { if (settled) return; settled = true; fn() }
        video!.onloadedmetadata = () => finish(resolve)
        video!.onerror = () => finish(() => reject(new Error('بارگذاری اطلاعات ویدیو ناموفق بود')))
        window.setTimeout(() => finish(() => reject(new Error('پاسخی از فایل ویدیو دریافت نشد'))), 25_000)
        video!.load()
      })

      const W = video.videoWidth
      const H = video.videoHeight
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      if (!W || !H || !duration) throw new Error('طول زمان یا ابعاد ویدیو نامعتبر است')

      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
      if (!ctx) throw new Error('مرورگر از Canvas پشتیبانی نمی‌کند')
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'

      stream = canvas.captureStream(FPS)

      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        audioCtx = new AudioContextClass()
        const source = audioCtx.createMediaElementSource(video)
        const destination = audioCtx.createMediaStreamDestination()
        source.connect(destination)
        destination.stream.getAudioTracks().forEach((track) => stream!.addTrack(track))
        if (audioCtx.state === 'suspended') await audioCtx.resume()
      } catch (err) {
        console.warn('[Audio Routing Failed]', err)
        video.muted = true
      }

      // ترجیح با mp4 استاندارد اگر مرورگر مستقیماً خروجی دهد (حذف کامل زمان تبدیل!)
      const mimeCandidates = [
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ]
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm'
      const isDirectMp4 = mime.includes('mp4')

      recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: isDirectMp4 ? 4_000_000 : 3_000_000,
      })

      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data)
      }

      const recorderStopped = new Promise<void>((resolve) => {
        recorder!.onstop = () => resolve()
      })

      const renderSubtitleLayer = (mediaTime: number) => {
        const t = clamp(mediaTime, 0, duration)
        const seg = segRef.current.find((item) => t >= item.start && t <= item.end)

        ctx.drawImage(video!, 0, 0, W, H)
        if (!seg) return

        const s = styleRef.current || DEFAULT_STYLE
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

        ctx.font = `800 ${finalFontSize}px "${fontFamily}", -apple-system, sans-serif`
        ctx.textBaseline = 'middle'
        ctx.textAlign = align

        const strokeWidth = Math.max(4, finalFontSize * 0.16)

        lines.forEach((line, index) => {
          const y = anchorY + (index - (lines.length - 1) / 2) * lineHeight
          const lineWords = line.split(/\s+/).filter(Boolean)

          // دورگیری و سایه استاندارد متن
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
          ctx.shadowBlur = Math.max(5, finalFontSize * 0.18)
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = strokeWidth
          ctx.strokeText(line, anchorX, y)

          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
          ctx.fillStyle = s.color || '#FFFFFF'
          ctx.fillText(line, anchorX, y)

          if (s.karaoke && seg.words?.length) {
            const activeWord = seg.words.find((w) => t >= w.start && t <= w.end && lineWords.includes(w.w))
            if (activeWord) {
              const lineWidth = ctx.measureText(line).width
              const spaceWidth = ctx.measureText(' ').width
              let cursorOffset = 0

              for (const w of lineWords) {
                const wWidth = ctx.measureText(w).width
                if (w === activeWord.w) {
                  let wordX = anchorX
                  if (direction === 'rtl') {
                    wordX = (anchorX + lineWidth / 2) - cursorOffset - (wWidth / 2)
                  } else {
                    wordX = (anchorX - lineWidth / 2) + cursorOffset + (wWidth / 2)
                  }

                  const prevAlign = ctx.textAlign
                  ctx.textAlign = 'center'
                  ctx.strokeStyle = '#000000'
                  ctx.lineWidth = strokeWidth
                  ctx.strokeText(w, wordX, y)

                  ctx.fillStyle = s.hlColor || '#FF4D4D'
                  ctx.fillText(w, wordX, y)
                  ctx.textAlign = prevAlign
                  break
                }
                cursorOffset += wWidth + spaceWidth
              }
            }
          }
        })

        ctx.restore()
      }

      setShowProgressPercent(true)
      setStatus(isDirectMp4 ? 'در حال رندر و ذخیره مستقیم...' : 'مرحله ۱ از ۲: رندر فریم‌های ویدیو...')
      recorder.start(1000)

      // فریم‌ریت ثابت ۳۰ فریم برای جلوگیری از لگ یا پریدگی فریم
      const step = 1 / FPS
      let currentTime = 0
      let frameRunning = true

      const runRenderLoop = async () => {
        while (frameRunning && currentTime <= duration) {
          video!.currentTime = currentTime
          await new Promise<void>((r) => {
            const onSeek = () => {
              video!.removeEventListener('seeked', onSeek)
              r()
            }
            video!.addEventListener('seeked', onSeek, { once: true })
          })

          renderSubtitleLayer(currentTime)

          // محاسبه درصد گرد و صحیح (بدون اعشار عجیب)
          const ratio = clamp(currentTime / duration, 0, 1)
          const currentPercent = isDirectMp4
            ? Math.round(ratio * 100)
            : Math.round(ratio * 50)
          setProgress(currentPercent)

          currentTime += step
        }
      }

      await runRenderLoop()

      if (recorder.state === 'recording') {
        recorder.stop()
      }
      await recorderStopped

      if (!chunks.length) throw new Error('فایلی برای خروجی ساخته نشد')

      // حالت ۱: اگر مرورگر مستقیماً MP4 داده باشد، بدون نیاز به FFmpeg دانلود را آغاز کن
      if (isDirectMp4) {
        setProgress(100)
        setStatus('در حال آماده‌سازی فایل دانلود...')
        const finalBlob = new Blob(chunks, { type: 'video/mp4' })
        const url = URL.createObjectURL(finalBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${baseName}.subtitled.mp4`
        document.body.appendChild(a)
        a.click()
        a.remove()
        setStatus('✅ با موفقیت ذخیره شد')
        return
      }

      // حالت ۲: نیاز به تبدیل کانتینر به MP4
      setStatus('مرحله ۲ از ۲: تبدیل بهینه به MP4...')
      setProgress(50)

      const ffmpeg = await getOrInitFFmpeg()

      // محاسبه دقیق لاگ‌های FFmpeg برای جلوگیری از فریز شدن روی ۵۰٪
      ffmpeg.on('log', ({ message }) => {
        const match = message.match(/time=(\d{2}:\d{2}:\d{2}\.\d+)/)
        if (match) {
          const currentSec = parseFFmpegTime(match[1])
          const encodeRatio = clamp(currentSec / duration, 0, 1)
          const calculated = Math.round(50 + encodeRatio * 50)
          setProgress((prev) => Math.max(prev, calculated))
        }
      })

      const webmBlob = new Blob(chunks, { type: mime })
      await ffmpeg.writeFile('input.webm', new Uint8Array(await webmBlob.arrayBuffer()))

      await ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '26',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        'output.mp4',
      ])

      const mp4Data = (await ffmpeg.readFile('output.mp4')) as Uint8Array
      const mp4Blob = new Blob([mp4Data], { type: 'video/mp4' })

      setProgress(100)
      setStatus('در حال دانلود...')

      const url = URL.createObjectURL(mp4Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${baseName}.subtitled.mp4`
      document.body.appendChild(a)
      a.click()
      a.remove()

      setStatus('✅ ویدیو با موفقیت ساخته شد')

      window.setTimeout(() => {
        URL.revokeObjectURL(url)
        ffmpeg.deleteFile('input.webm').catch(() => {})
        ffmpeg.deleteFile('output.mp4').catch(() => {})
      }, 5000)

    } catch (error: any) {
      console.error('[Export Error]', error)
      setStatus('❌ خطا در رندر')
      alert('خطا در ذخیره ویدیو: ' + (error?.message || 'مشکل در فرآیند رندر'))
    } finally {
      try { video?.pause() } catch {}
      if (stream) stream.getTracks().forEach((track) => track.stop())
      if (audioCtx) audioCtx.close().catch(() => {})
      if (video?.parentNode) video.parentNode.removeChild(video)
      setExporting(false)
      setShowProgressPercent(false)
    }
  }

  const safeProgress = clamp(Math.round(Number(progress) || 0), 0, 100)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 p-4">
      <button
        onClick={exportVideo}
        disabled={exporting}
        className="w-full rounded-xl bg-orange-500 py-4 font-bold text-white transition-all hover:bg-orange-600 disabled:bg-gray-700"
      >
        {exporting ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{status}</span>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-200"
                style={{ width: `${safeProgress}%` }}
              />
            </div>
            {showProgressPercent && (
              <span className="text-xs font-mono text-gray-300">
                {safeProgress}%
              </span>
            )}
          </div>
        ) : (
          '📹 خروجی MP4 با زیرنویس'
        )}
      </button>
    </div>
  )
}
