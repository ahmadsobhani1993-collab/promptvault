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

// بیت‌ریت بهینه برای جلوگیری از افزایش بی‌رویه حجم در مرحله واسط
const WEBM_BITRATE = 3_500_000

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
  const [isRenderingProgress, setIsRenderingProgress] = useState(false)
  
  const currentStyle = style || DEFAULT_STYLE
  const styleRef = useRef(currentStyle)
  styleRef.current = currentStyle
  const segRef = useRef(segments)
  segRef.current = segments

  const exportVideo = async () => {
    if (exporting || !videoUrl) return
    setExporting(true)
    setProgress(0)
    setIsRenderingProgress(false)
    setStatus('در حال آماده‌سازی ویدیو...')

    let video: HTMLVideoElement | null = null
    let audioCtx: AudioContext | null = null
    let audioRouted = false
    let ffmpeg: FFmpeg | null = null
    let recorder: MediaRecorder | null = null
    let stream: MediaStream | null = null

    try {
      const storedStyle = readStoredStyle()
      const exportStyle: Style = { ...DEFAULT_STYLE, ...(storedStyle || {}), ...(style || {}) }
      styleRef.current = exportStyle

      video = document.createElement('video')
      video.src = videoUrl
      video.playsInline = true
      video.preload = 'auto'
      video.muted = false
      video.volume = 1
      video.crossOrigin = 'anonymous'
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
        video!.onerror = () => finish(() => reject(new Error('لود ویدیو ناموفق بود')))
        window.setTimeout(() => finish(() => reject(new Error('تایم‌اوت لود ویدیو'))), 25_000)
        video!.load()
      })

      const W = video.videoWidth
      const H = video.videoHeight
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      if (!W || !H || !duration) throw new Error('ابعاد یا مدت زمان ویدیو معتبر نیست')

      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
      if (!ctx) throw new Error('عدم پشتیبانی مرورگر از Canvas')

      // تنظیمات استاندارد قلم و گرافیک
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'

      setStatus('در حال بارگذاری فونت و المان‌ها...')
      await loadFont(exportStyle.fontId || 'Vazirmatn')
      try { await document.fonts.ready } catch {}

      stream = canvas.captureStream(FPS)

      // ضبط ترک صدا
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        audioCtx = new AudioContextClass()
        const source = audioCtx.createMediaElementSource(video)
        const destination = audioCtx.createMediaStreamDestination()
        source.connect(destination)
        destination.stream.getAudioTracks().forEach((track) => stream!.addTrack(track))
        if (audioCtx.state === 'suspended') await audioCtx.resume()
        audioRouted = true
      } catch (error) {
        console.warn('[Export] Audio capture bypass:', error)
        video.muted = true
      }

      const mimeCandidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ]
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm'

      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: WEBM_BITRATE })
      const chunks: Blob[] = []
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data)
      }
      const recorderStopped = new Promise<void>((resolve) => { recorder!.onstop = () => resolve() })

      // تابع ترسیم هوشمند فریم و استایل شبیه نمونه بالا
      const renderFrame = (mediaTime: number) => {
        const t = clamp(mediaTime, 0, duration)
        const seg = segRef.current.find((item) => t >= item.start && t <= item.end)
        
        ctx.clearRect(0, 0, W, H)
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
        // اگر کاربر تعیین نکرده بود، ارتفاع ۲۵٪ تا ۳۰٪ از پایین ویدیو قرار می‌گیرد
        const anchorY = s.y != null ? (Number(s.y) / 100) * H : H * 0.78
        const fontFamily = s.fontId || 'Vazirmatn'

        // محاسبه سایز فونت متناسب با عرض ویدیو (بین ۴.۵ تا ۵.۵ درصد عرض ویدیو)
        const baseFontSize = s.size ? (Number(s.size) / 100) * W : W * 0.052

        const fitted = fitSubtitle(ctx, seg.text, baseFontSize, maxSubtitleWidth, maxSubtitleHeight, fontFamily)
        const finalFontSize = fitted.fontSize
        const lines = fitted.lines
        const lineHeight = fitted.lineHeight

        ctx.save()
        ctx.direction = direction

        // اعمال انیمیشن نرم
        ctx.globalAlpha = anim.opacity
        ctx.translate(anchorX + anim.translateX, anchorY + anim.translateY)
        ctx.scale(anim.scale, anim.scale)
        ctx.translate(-anchorX, -anchorY)

        ctx.font = `800 ${finalFontSize}px "${fontFamily}", -apple-system, sans-serif`
        ctx.textBaseline = 'middle'
        ctx.textAlign = align

        const strokeWidth = Math.max(4, finalFontSize * 0.16)

        // رندر خط به خط
        lines.forEach((line, index) => {
          const y = anchorY + (index - (lines.length - 1) / 2) * lineHeight
          const lineWords = line.split(/\s+/).filter(Boolean)

          // اگر کارائوکه غیرفعال بود یا لیستی از کلمات نداشتیم: رندر یکپارچه تمیز
          if (!s.karaoke || !seg.words || !seg.words.length) {
            // ۱. سایه عمیق تیره نرم پشت متن
            ctx.shadowColor = 'rgba(0, 0, 0, 0.75)'
            ctx.shadowBlur = Math.max(6, finalFontSize * 0.2)
            ctx.shadowOffsetX = 0
            ctx.shadowOffsetY = 3

            // ۲. دورگیری (Stroke) مشکی دقیق
            ctx.strokeStyle = '#000000'
            ctx.lineWidth = strokeWidth
            ctx.strokeText(line, anchorX, y)

            // ریست سایه برای جلوگیری از مات شدن داخل متن
            ctx.shadowColor = 'transparent'
            ctx.shadowBlur = 0

            // ۳. پر کردن متن اصلی
            ctx.fillStyle = s.color || '#FFFFFF'
            ctx.fillText(line, anchorX, y)
            return
          }

          // حالت کارائوکه بدون به‌هم‌ریختگی کلمات فارسی:
          // متن کامل را یک‌بار استروک مشکی و رنگ زمینه می‌زنیم تا پیوستگی حفظ شود
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
          ctx.shadowBlur = Math.max(6, finalFontSize * 0.2)
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = strokeWidth
          ctx.strokeText(line, anchorX, y)

          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
          ctx.fillStyle = s.color || '#FFFFFF'
          ctx.fillText(line, anchorX, y)

          // حالا کلمه فعال در بازه زمانی را پیدا کرده و هایلایت شبیه تصویر بالا روی آن می‌اندازیم
          const activeWordTiming = seg.words.find((w) => t >= w.start && t <= w.end && lineWords.includes(w.w))
          
          if (activeWordTiming) {
            const lineWidth = ctx.measureText(line).width
            const spaceWidth = ctx.measureText(' ').width
            let cursorOffset = 0

            // محاسبه موقعیت دقیق کلمه درون خط متناسب با RTL / LTR
            for (const w of lineWords) {
              const wWidth = ctx.measureText(w).width
              if (w === activeWordTiming.w) {
                let wordX = anchorX
                if (direction === 'rtl') {
                  // در حالت راست‌به‌چپ: از راست شروع می‌شود
                  wordX = (anchorX + lineWidth / 2) - cursorOffset - (wWidth / 2)
                } else {
                  wordX = (anchorX - lineWidth / 2) + cursorOffset + (wWidth / 2)
                }

                const prevAlign = ctx.textAlign
                ctx.textAlign = 'center'
                ctx.strokeStyle = '#000000'
                ctx.lineWidth = strokeWidth
                ctx.strokeText(w, wordX, y)

                // رنگ کلمه فعال (نارنجی/قرمز زیبا طبق تصویر بالا)
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

      let rafId: number | null = null
      let stopped = false

      const stopRecording = () => {
        if (stopped) return
        stopped = true
        if (rafId != null) cancelAnimationFrame(rafId)
        if (recorder?.state === 'recording') recorder.stop()
      }

      const tick = () => {
        if (stopped) return
        try {
          const t = video!.currentTime
          renderFrame(t)
          // درصد دقیق رندر فریم‌ها
          setProgress(clamp((t / duration) * 100, 0, 100))
          
          if (video!.ended || t >= duration - 0.05) {
            renderFrame(duration)
            setProgress(100)
            stopRecording()
            return
          }
        } catch (frameError) {
          console.error('[Export] Frame Render Error:', frameError)
        }
        rafId = requestAnimationFrame(tick)
      }

      video.addEventListener('ended', () => {
        if (stopped) return
        renderFrame(duration)
        setProgress(100)
        stopRecording()
      }, { once: true })

      // شروع ضبط و رندر ویدیو (تنها اینجا نوار پیشرفت فعال می‌شود)
      setIsRenderingProgress(true)
      setStatus('در حال رندر و ضبط فریم‌ها...')
      recorder.start(1000)
      video.currentTime = 0
      await video.play()
      rafId = requestAnimationFrame(tick)

      await recorderStopped
      if (!chunks.length) throw new Error('اطلاعات ویدیویی ضبط نشد')

      // مرحله تبدیل FFmpeg: مخفی کردن درصد و نمایش وضعیت متنی روان
      setIsRenderingProgress(false)
      setStatus('بهینه‌سازی نهایی و کاهش حجم فایل...')

      ffmpeg = new FFmpeg()
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
      const [coreResponse, wasmResponse] = await Promise.all([
        fetch(`${baseURL}/ffmpeg-core.js`),
        fetch(`${baseURL}/ffmpeg-core.wasm`),
      ])
      if (!coreResponse.ok || !wasmResponse.ok) throw new Error('دریافت ماژول پردازش ویدیو با خطا مواجه شد')

      const [coreBlob, wasmBlob] = await Promise.all([coreResponse.blob(), wasmResponse.blob()])
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

      // بهینه‌سازی سرعت و کاهش حجم:
      // پریست ultrafast / veryfast زمان انکود را تا ۷۰٪ کم می‌کند
      // مقدار crf: 26 باعث حفظ شفافیت و کاهش چشمگیر حجم می‌شود
      await ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '26',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        'output.mp4',
      ])

      const mp4Data = (await ffmpeg.readFile('output.mp4')) as Uint8Array
      const mp4Blob = new Blob([mp4Data], { type: 'video/mp4' })

      setStatus('در حال ذخیره‌سازی...')
      const url = URL.createObjectURL(mp4Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${baseName}.subtitled.mp4`
      document.body.appendChild(a)
      a.click()
      a.remove()

      setStatus('✅ آماده شد!')

      window.setTimeout(() => {
        URL.revokeObjectURL(url)
        ffmpeg?.deleteFile('input.webm').catch(() => {})
        ffmpeg?.deleteFile('output.mp4').catch(() => {})
      }, 4000)
    } catch (error: any) {
      console.error('[Export Error]', error)
      setStatus('❌ خطا در عملیات')
      alert('❌ خطا در خروجی ویدیو: ' + (error?.message || 'نامشخص'))
    } finally {
      try { video?.pause() } catch {}
      if (stream) stream.getTracks().forEach((track) => track.stop())
      if (audioCtx) audioCtx.close().catch(() => {})
      if (video?.parentNode) video.parentNode.removeChild(video)
      setExporting(false)
      setIsRenderingProgress(false)
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
              {isRenderingProgress ? (
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-150"
                  style={{ width: `${safeProgress}%` }}
                />
              ) : (
                <div className="h-full w-full animate-pulse rounded-full bg-white/70" />
              )}
            </div>
            {isRenderingProgress && (
              <span className="text-xs">{Math.round(safeProgress)}%</span>
            )}
          </div>
        ) : (
          '📹 خروجی MP4 با زیرنویس'
        )}
      </button>
    </div>
  )
}
