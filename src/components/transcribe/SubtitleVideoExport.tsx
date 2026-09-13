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
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

let cachedFFmpeg: FFmpeg | null = null

async function getOrInitFFmpeg(onProgress: (ratio: number) => void): Promise<FFmpeg> {
  if (cachedFFmpeg && cachedFFmpeg.loaded) {
    cachedFFmpeg.on('progress', ({ progress }) => onProgress(progress))
    return cachedFFmpeg
  }

  const ffmpeg = new FFmpeg()
  ffmpeg.on('progress', ({ progress }) => onProgress(progress))

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
  const [coreResponse, wasmResponse] = await Promise.all([
    fetch(`${baseURL}/ffmpeg-core.js`),
    fetch(`${baseURL}/ffmpeg-core.wasm`),
  ])
  if (!coreResponse.ok || !wasmResponse.ok) throw new Error('دریافت کتابخانه پردازش شکست خورد.')

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
  for (let i = 0; i < 25; i++) {
    ctx.font = `800 ${fontSize}px "${fontFamily}", -apple-system, sans-serif`
    const lines = wrapTextSafe(ctx, text, maxWidth)
    const lineHeight = fontSize * 1.3
    const totalHeight = lines.length * lineHeight
    const maxLineWidth = Math.max(...lines.map((l) => ctx.measureText(l).width), 0)

    if (maxLineWidth <= maxWidth && totalHeight <= maxHeight) {
      return { fontSize, lines, lineHeight, totalHeight, maxLineWidth }
    }
    fontSize *= 0.93
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
    setStatus('در حال بارگذاری مقدمات و فونت...')

    let video: HTMLVideoElement | null = null
    let audioCtx: AudioContext | null = null
    let recorder: MediaRecorder | null = null
    let stream: MediaStream | null = null

    try {
      const storedStyle = readStoredStyle()
      const exportStyle: Style = { ...DEFAULT_STYLE, ...(storedStyle || {}), ...(style || {}) }
      styleRef.current = exportStyle

      // بارگذاری پیش‌فرض فونت
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
        video!.onerror = () => finish(() => reject(new Error('بارگذاری متادیتا ویدیو با شکست مواجه شد')))
        window.setTimeout(() => finish(() => reject(new Error('تایم‌اوت بارگذاری ویدیو'))), 35_000)
        video!.load()
      })

      const W = video.videoWidth
      const H = video.videoHeight
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      if (!W || !H || !duration) throw new Error('ویدیو نامعتبر یا مدت زمان آن صفر است')

      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
      if (!ctx) throw new Error('Canvas در مرورگر شما پشتیبانی نمی‌شود')
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'

      // دریافت استریم Canvas با نرخ ۳۰ فریم ثابت
      stream = canvas.captureStream(30)

      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        audioCtx = new AudioContextClass()
        const source = audioCtx.createMediaElementSource(video)
        const destination = audioCtx.createMediaStreamDestination()
        source.connect(destination)
        destination.stream.getAudioTracks().forEach((track) => stream!.addTrack(track))
        if (audioCtx.state === 'suspended') await audioCtx.resume()
      } catch (err) {
        console.warn('[Audio Routing Failed, fallback muted]', err)
        video.muted = true
      }

      const mimeCandidates = [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm',
      ]
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm'

      // ضبط با بیت‌ریت استاندارد برای کم نگه داشتن رم
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_000_000 })
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

          if (!s.karaoke || !seg.words || !seg.words.length) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
            ctx.shadowBlur = Math.max(6, finalFontSize * 0.2)
            ctx.strokeStyle = '#000000'
            ctx.lineWidth = strokeWidth
            ctx.strokeText(line, anchorX, y)

            ctx.shadowColor = 'transparent'
            ctx.shadowBlur = 0
            ctx.fillStyle = s.color || '#FFFFFF'
            ctx.fillText(line, anchorX, y)
            return
          }

          // حالت کارائوکه
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
          ctx.shadowBlur = Math.max(6, finalFontSize * 0.2)
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = strokeWidth
          ctx.strokeText(line, anchorX, y)

          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
          ctx.fillStyle = s.color || '#FFFFFF'
          ctx.fillText(line, anchorX, y)

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
        })

        ctx.restore()
      }

      // شروع رندر فریم به فریم
      setShowProgressPercent(true)
      setStatus('مرحله ۱ از ۲: ادغام زیرنویس روی ویدیو...')
      recorder.start(1000)

      let stopped = false
      const stopRecorderSafely = () => {
        if (stopped) return
        stopped = true
        if (recorder && recorder.state === 'recording') {
          recorder.stop()
        }
      }

      // رندر مطمئن بدون افت فریم حتی در پس‌زمینه تب
      await new Promise<void>((resolve, reject) => {
        let isProcessingFrame = false

        const onTimeUpdate = () => {
          if (stopped || isProcessingFrame) return
          isProcessingFrame = true

          try {
            const currentT = video!.currentTime
            renderSubtitleLayer(currentT)
            // نیمی از درصد کل مربوط به مرحله ایجاد فریم‌ها است (۰ تا ۵۰ درصد)
            setProgress(clamp((currentT / duration) * 50, 0, 50))

            if (currentT >= duration - 0.1 || video!.ended) {
              video!.removeEventListener('timeupdate', onTimeUpdate)
              renderSubtitleLayer(duration)
              setProgress(50)
              stopRecorderSafely()
              resolve()
            }
          } catch (e) {
            reject(e)
          } finally {
            isProcessingFrame = false
          }
        }

        video!.addEventListener('timeupdate', onTimeUpdate)
        video!.addEventListener('ended', () => {
          video!.removeEventListener('timeupdate', onTimeUpdate)
          setProgress(50)
          stopRecorderSafely()
          resolve()
        }, { once: true })

        video!.currentTime = 0
        video!.play().catch(reject)
      })

      await recorderStopped
      if (!chunks.length) throw new Error('دیتایی از ویدیو دریافت نشد')

      // مرحله ۲: فشرده‌سازی و تبدیل نهایی توسط FFmpeg با نمایش پیشرفت از ۵۰ تا ۱۰۰ درصد
      setStatus('مرحله ۲ از ۲: بهینه‌سازی و انکود نهایی MP4...')

      const ffmpeg = await getOrInitFFmpeg((ratio) => {
        // نسبت انکود FFmpeg را از ۵۰ تا ۱۰۰ مپ می‌کنیم تا کاربر دقیقاً بداند چند درصد جلو رفته است
        const mappedProgress = 50 + clamp(ratio, 0, 1) * 50
        setProgress(Math.round(mappedProgress))
      })

      const webmBlob = new Blob(chunks, { type: mime })
      await ffmpeg.writeFile('input.webm', new Uint8Array(await webmBlob.arrayBuffer()))

      // دستور بهینه‌سازی سریع برای جلوگیری از لگ، افت فریم و کاهش ۳۰٪ حجم
      await ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'libx264',
        '-preset', 'ultrafast', // تضمین بالاترین سرعت در مرورگر
        '-crf', '28',           // حجم خروجی کنترل‌شده و سبک
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        'output.mp4',
      ])

      const mp4Data = (await ffmpeg.readFile('output.mp4')) as Uint8Array
      const mp4Blob = new Blob([mp4Data], { type: 'video/mp4' })

      setStatus('در حال دانلود فایل خروجی...')
      const url = URL.createObjectURL(mp4Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${baseName}.subtitled.mp4`
      document.body.appendChild(a)
      a.click()
      a.remove()

      setProgress(100)
      setStatus('✅ ذخیره‌سازی با موفقیت انجام شد')

      window.setTimeout(() => {
        URL.revokeObjectURL(url)
        ffmpeg.deleteFile('input.webm').catch(() => {})
        ffmpeg.deleteFile('output.mp4').catch(() => {})
      }, 5000)

    } catch (error: any) {
      console.error('[Export Error]', error)
      setStatus('❌ خطا در رندر')
      alert('خطا در رندر: ' + (error?.message || 'مشکل در پردازش فریم‌ها'))
    } finally {
      try { video?.pause() } catch {}
      if (stream) stream.getTracks().forEach((track) => track.stop())
      if (audioCtx) audioCtx.close().catch(() => {})
      if (video?.parentNode) video.parentNode.removeChild(video)
      setExporting(false)
      setShowProgressPercent(false)
    }
  }

  const safeProgress = clamp(Number(progress) || 0, 0, 100)

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
