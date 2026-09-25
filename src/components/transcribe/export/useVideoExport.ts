'use client'

import { useRef, useState } from 'react'
import { DEFAULT_STYLE, loadFont, type Seg, type Style } from '@/lib/subtitle-studio'
import { clamp, drawSubtitleOnCanvas } from './subtitle-canvas'

const STYLE_STORAGE_KEY = 'promptvault.subtitle.style'
const FPS = 30
const FALLBACK_COLOR_SPACE = { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false } as const

let cachedFFmpeg: any = null

export async function getOrInitFFmpeg(): Promise<any> {
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

export function readStoredStyle(): Partial<Style> | null {
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

export function useVideoExport(videoUrl: string, baseName = 'video', segments: Seg[], style?: Style) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [eta, setEta] = useState<string>('')

  const abortRef = useRef(false)
  const segRef = useRef(segments)
  segRef.current = segments

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
      const activeStyle: Style = { ...DEFAULT_STYLE, ...(storedStyle || {}), ...(style || {}) }

      await loadFont(activeStyle.fontId || 'Vazirmatn')
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

      let chunkIndexDebug = 0
      let lastChunkMetaDebug = 'ثبت‌نشده'
      let encoderFatalError: Error | null = null

      const encoder = new (window as any).VideoEncoder({
        output: (chunk: any, meta: any) => {
          chunkIndexDebug++
          try { lastChunkMetaDebug = JSON.stringify(meta) } catch { lastChunkMetaDebug = String(meta) }

          if (!meta) {
            meta = { decoderConfig: { codec: 'avc1.4d002a', codedWidth: W, codedHeight: H, colorSpace: FALLBACK_COLOR_SPACE } }
          } else if (!meta.decoderConfig) {
            meta = { ...meta, decoderConfig: { codec: 'avc1.4d002a', codedWidth: W, codedHeight: H, colorSpace: FALLBACK_COLOR_SPACE } }
          } else if (!meta.decoderConfig.colorSpace) {
            meta = { ...meta, decoderConfig: { ...meta.decoderConfig, colorSpace: FALLBACK_COLOR_SPACE } }
          }

          try {
            muxer.addVideoChunk(chunk, meta)
          } catch (muxErr: any) {
            encoderFatalError = new Error(
              `کرش داخل addVideoChunk، چانک شماره ${chunkIndexDebug}: ${muxErr?.message || muxErr}\nmeta همین چانک: ${lastChunkMetaDebug}`
            )
          }
        },
        error: (e: any) => {
          console.error('[VideoEncoder error]', e)
          if (!encoderFatalError) encoderFatalError = e
        },
      })

      encoder.configure({
        codec: 'avc1.4d002a',
        width: W,
        height: H,
        bitrate: calculatedBitrate,
        framerate: FPS,
      })

      setStatus('در حال پردازش فریم‌ها...')
      const totalFrames = Math.ceil(duration * FPS)
      const frameDurationMicroseconds = 1_000_000 / FPS
      const startTime = performance.now()

      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (abortRef.current) throw new Error('عملیات رندر توسط کاربر لغو شد.')

        const currentTime = frameIndex / FPS
        video.currentTime = currentTime

        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video!.removeEventListener('seeked', onSeeked)
            resolve()
          }
          video!.addEventListener('seeked', onSeeked, { once: true })
        })

        drawSubtitleOnCanvas(ctx, video, W, H, currentTime, duration, segRef.current, activeStyle)

        const frame = new VideoFrameClass(canvas, {
          timestamp: Math.round(frameIndex * frameDurationMicroseconds),
          duration: Math.round(frameDurationMicroseconds),
        })

        const isKeyFrame = frameIndex % FPS === 0
        encoder.encode(frame, { keyFrame: isKeyFrame })
        frame.close()

        if (encoder.encodeQueueSize > 5) {
          await encoder.flush()
        }
        if (encoderFatalError) throw encoderFatalError

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
      if (encoderFatalError) throw encoderFatalError

      try {
        muxer.finalize()
      } catch (finErr: any) {
        throw new Error(
          `کرش داخل muxer.finalize(): ${finErr?.message || finErr}\nتعداد کل چانک‌ها: ${chunkIndexDebug}\nآخرین meta دیده‌شده: ${lastChunkMetaDebug}`
        )
      }

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

  return {
    exporting,
    progress: clamp(Math.round(Number(progress) || 0), 0, 100),
    status,
    eta,
    exportVideo,
    cancelExport,
  }
}
