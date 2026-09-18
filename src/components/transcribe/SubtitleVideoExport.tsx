'use client'

import { useEffect, useRef, useState } from 'react'
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
  baseName?: string
  segments: Seg[]
  style?: Style
}

const STYLE_STORAGE_KEY = 'promptvault.subtitle.style'
const FPS = 30
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

let cachedFFmpeg: any = null

async function getOrInitFFmpeg(): Promise<any> {
  if (cachedFFmpeg && cachedFFmpeg.loaded) return cachedFFmpeg

  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  const { toBlobURL } = await import('@ffmpeg/util')

  const ffmpeg = new FFmpeg()
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

  const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript')
  const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')

  await ffmpeg.load({ coreURL, wasmURL })

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

export default function SubtitleVideoExport({ videoUrl, baseName = 'video', segments, style }: Props) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [eta, setEta] = useState<string>('')

  const abortRef = useRef(false)
  const currentStyle = style || DEFAULT_STYLE
  const styleRef = useRef(currentStyle)
  styleRef.current = currentStyle
  const segRef = useRef(segments)
  segRef.current = segments

  useEffect(() => {
    loadFont(currentStyle.fontId || 'Vazirmatn').catch(() => {})
    getOrInitFFmpeg().catch(() => {})
  }, [currentStyle.fontId])

  const cancelExport = () => {
    abortRef.current = true
    setStatus('در حال لغو عملیات...')
  }

  const exportVideo = async () => {
    const safeBaseName = String(baseName || 'video')
    const matchExt = safeBaseName.match(/\.(mp4|mov|webm|mkv)$/i)
    const ext = matchExt ? matchExt[1].toLowerCase() : 'mp4'
    const cleanBaseName = safeBaseName.replace(/\.[^/.]+$/, '') || 'video'
    const mimeType = ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4'

    if (exporting || !videoUrl) return
    setExporting(true)
    setProgress(0)
    setEta('')
    abortRef.current = false
    setStatus('در حال آماده‌سازی...')

    let video: HTMLVideoElement | null = null

    try {
      if (typeof (window as any).VideoEncoder === 'undefined') {
        throw new Error('مرورگر شما از WebCodecs پشتیبانی نمی‌کند. لطفاً از آخرین نسخه Chrome یا Edge استفاده کنید.')
      }

      const storedStyle = readStoredStyle()
      const exportStyle: Style = { ...DEFAULT_STYLE, ...(storedStyle || {}), ...(style || {}) }
      styleRef.current = exportStyle

      await loadFont(exportStyle.fontId || 'Vazirmatn')
      try { await document.fonts.ready } catch {}

      video = document.createElement('video')
      video.src = videoUrl
      video.playsInline = true
      video.preload = 'auto'
      video.crossOrigin = 'anonymous'
      video.muted = true
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
        video!.onerror = () => finish(() => reject(new Error('بارگذاری اطلاعات اولیه ویدیو ناموفق بود')))
        window.setTimeout(() => finish(() => reject(new Error('پاسخی از سورس ویدیو دریافت نشد'))), 25_000)
        video!.load()
      })

      const W = video.videoWidth % 2 === 0 ? video.videoWidth : video.videoWidth - 1
      const H = video.videoHeight % 2 === 0 ? video.videoHeight : video.videoHeight - 1
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      if (!W || !H || !duration) throw new Error('ابعاد یا طول ویدیو نامعتبر است')

      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
      if (!ctx) throw new Error('خطا در دسترسی به بستر Canvas')
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'

      const mp4Mod: any = await import(/* webpackIgnore: true */ 'https://esm.sh/mp4-muxer@5.1.4')
      const MuxerClass = mp4Mod.Muxer || mp4Mod.default?.Muxer
      const TargetClass = mp4Mod.ArrayBufferTarget || mp4Mod.default?.ArrayBufferTarget
      if (typeof MuxerClass !== 'function' || typeof TargetClass !== 'function') {
        throw new Error('عدم امکان بارگذاری کامپوننت سازنده MP4')
      }

      const target = new TargetClass()
      const muxer = new MuxerClass({
        target,
        video: { codec: 'avc', width: W, height: H },
        fastStart: 'in-memory',
      })

      const calculatedBitrate = Math.round(clamp((W * H * 2.2), 1_500_000, 4_500_000))
      const VideoFrameClass = typeof VideoFrame !== 'undefined' ? VideoFrame : (window as any).VideoFrame
      if (typeof VideoFrameClass !== 'function') {
        throw new Error('WebCodecs VideoFrame در مرورگر پشتیبانی نمی‌شود.')
      }

      const encoder = new (window as any).VideoEncoder({
        output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
        error: (e: any) => console.error('[VideoEncoder error]', e),
      })

      encoder.configure({
        codec: 'avc1.4d002a',
        width: W,
        height: H,
        bitrate: calculatedBitrate,
        framerate: FPS,
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

        if (!s.karaoke || !seg.words || !seg.words.length) {
          lines.forEach((line, index) => {
            const y = anchorY + (index - (lines.length - 1) / 2) * lineHeight
            ctx.shadowColor = 'rgba(0, 0, 0, 0.85)'
            ctx.shadowBlur = Math.max(6, finalFontSize * 0.2)
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
              ctx.shadowColor = 'rgba(0, 0, 0, 0.85)'
              ctx.shadowBlur = Math.max(6, finalFontSize * 0.2)
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

      setStatus('در حال پردازش فریم‌ها...')
      const totalFrames = Math.ceil(duration * FPS)
      const frameDurationMicroseconds = 1_000_000 / FPS
      const startTime = performance.now()

      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (abortRef.current) {
          throw new Error('عملیات رندر توسط کاربر لغو شد.')
        }

        const currentTime = frameIndex / FPS
        video.currentTime = currentTime

        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video!.removeEventListener('seeked', onSeeked)
            resolve()
          }
          video!.addEventListener('seeked', onSeeked, { once: true })
        })

        renderSubtitleLayer(currentTime)

        const frame = new VideoFrameClass(canvas, {
          timestamp: Math.round(frameIndex * frameDurationMicroseconds),
        })

        const isKeyFrame = frameIndex % FPS === 0
        encoder.encode(frame, { keyFrame: isKeyFrame })
        frame.close()

        if (encoder.encodeQueueSize > 5) {
          await encoder.flush()
        }

        const elapsedSec = (performance.now() - startTime) / 1000
        const framesDone = frameIndex + 1
        const remainingFrames = totalFrames - framesDone
        const fpsReal = framesDone / Math.max(elapsedSec, 0.1)
        const remainingSeconds = Math.round(remainingFrames / fpsReal)

        if (framesDone > 10 && remainingSeconds > 0) {
          setEta(`حدود ${remainingSeconds} ثانیه باقی‌مانده`)
        }

        const framePercent = Math.round((framesDone / totalFrames) * 85)
        setProgress(framePercent)
      }

      await encoder.flush()
      muxer.finalize()

      if (abortRef.current) throw new Error('عملیات رندر توسط کاربر لغو شد.')

      setProgress(86)
      setEta('')
      setStatus('در حال ادغام صدای اصلی...')

      const ffmpeg = await getOrInitFFmpeg()
      const videoArrayBuffer = target.buffer
      await ffmpeg.writeFile('sub_video.mp4', new Uint8Array(videoArrayBuffer))

      const sourceResponse = await fetch(videoUrl)
      const sourceBlob = await sourceResponse.blob()
      const sourceInName = ext === 'mov' ? 'source_input.mov' : 'source_input.mp4'
      await ffmpeg.writeFile(sourceInName, new Uint8Array(await sourceBlob.arrayBuffer()))

      setProgress(92)
      const outFileName = 'final_output.mp4'
      await ffmpeg.exec([
        '-i', 'sub_video.mp4',
        '-i', sourceInName,
        '-map', '0:v:0',
        '-map', '1:a:0?',
        '-c:v', 'copy',
        '-c:a', 'copy',
        '-movflags', '+faststart',
        outFileName,
      ])

      const finalData = (await ffmpeg.readFile(outFileName)) as Uint8Array
      const finalBlob = new Blob([finalData], { type: mimeType })

      setProgress(100)
      setStatus('✅ ذخیره‌سازی ویدیو...')

      const url = URL.createObjectURL(finalBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${cleanBaseName}.subtitled.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()

      window.setTimeout(() => {
        URL.revokeObjectURL(url)
        ffmpeg.deleteFile('sub_video.mp4').catch(() => {})
        ffmpeg.deleteFile(sourceInName).catch(() => {})
        ffmpeg.deleteFile(outFileName).catch(() => {})
      }, 5000)

    } catch (error: any) {
      if (abortRef.current) {
        setStatus('عملیات لغو شد')
      } else {
        console.error('[WebCodecs Render Error]', error)
        setStatus('❌ خطا در رندر')
        alert('خطا: ' + (error?.message || 'مشکلی در عملیات رندر پیش آمد'))
      }
    } finally {
      if (video?.parentNode) video.parentNode.removeChild(video)
      setExporting(false)
      setEta('')
    }
  }

  const safeProgress = clamp(Math.round(Number(progress) || 0), 0, 100)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 p-4">
      {exporting ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-white">{status}</span>
            <div className="flex items-center gap-2">
              {eta && <span className="text-amber-400 font-mono">{eta}</span>}
              <button
                onClick={cancelExport}
                className="rounded-lg border border-red-500/40 bg-red-500/20 px-2.5 py-1 text-red-300 transition hover:bg-red-500/30"
              >
                ✕ لغو رندر
              </button>
            </div>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-amber-500 transition-[width] duration-150"
              style={{ width: `${safeProgress}%` }}
            />
          </div>
          <span className="text-xs font-mono text-gray-300 text-left">{safeProgress}%</span>
        </div>
      ) : (
        (() => {
          const isReady = Boolean(videoUrl && segments && segments.length > 0)
          return (
            <button
              onClick={exportVideo}
              disabled={exporting || !isReady}
              className={`w-full rounded-xl py-4 font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                !isReady
                  ? 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50 shadow-none'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400 cursor-pointer active:scale-[0.99]'
              }`}
            >
              <span>📹</span>
              <span>
                {!videoUrl
                  ? 'ابتدا ویدیو را بارگذاری کنید'
                  : !segments || segments.length === 0
                  ? 'در انتظار پردازش و تکمیل زیرنویس...'
                  : 'خروجی MP4 با زیرنویس'}
              </span>
            </button>
          )
        })()
      )}
    </div>
  )
}
