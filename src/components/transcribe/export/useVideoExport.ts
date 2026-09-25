'use client'

import { useRef, useState } from 'react'
import { StudioSegment, StudioStyleConfig } from '@/lib/studio/unified-style'
import { renderStudioFrame, clampCanvasDimensions } from '@/lib/studio/universal-renderer'
import { ensureFontLoaded } from '@/lib/studio/font-loader'

const FPS = 30
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

let cachedFFmpeg: any = null
let ffmpegIsLoaded = false

async function getOrInitFFmpeg(): Promise<any> {
  if (cachedFFmpeg && ffmpegIsLoaded) return cachedFFmpeg
  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  const { toBlobURL } = await import('@ffmpeg/util')

  const ffmpeg = new FFmpeg()
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
  const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript')
  const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')

  await ffmpeg.load({ coreURL, wasmURL })
  cachedFFmpeg = ffmpeg
  ffmpegIsLoaded = true
  return ffmpeg
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const onSeeked = () => {
      if (done) return
      done = true
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked, { once: true })
    video.currentTime = time
    setTimeout(() => {
      if (!done) {
        done = true
        video.removeEventListener('seeked', onSeeked)
        resolve()
      }
    }, 700)
  })
}

export function useVideoExport(
  videoUrl: string,
  baseName = 'video',
  segments: StudioSegment[],
  styleConfig: StudioStyleConfig
) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')

  const abortRef = useRef(false)

  const cancelExport = () => {
    abortRef.current = true
    setStatus('در حال لغو عملیات...')
  }

  const exportVideo = async () => {
    if (exporting || !videoUrl) return
    setExporting(true)
    setProgress(0)
    abortRef.current = false
    setStatus('آماده‌سازی بافر ویدیو و فونت...')

    let video: HTMLVideoElement | null = null
    let sharedBlob: Blob | null = null

    try {
      await ensureFontLoaded(styleConfig.fontFamily)

      const resp = await fetch(videoUrl)
      sharedBlob = await resp.blob()
      const localBlobUrl = URL.createObjectURL(sharedBlob)

      video = document.createElement('video')
      video.src = localBlobUrl
      video.playsInline = true
      video.preload = 'auto'
      video.muted = true
      video.style.position = 'fixed'
      video.style.left = '-10000px'
      video.style.top = '-10000px'
      document.body.appendChild(video)

      await new Promise<void>((resolve, reject) => {
        video!.onloadedmetadata = () => resolve()
        video!.onerror = () => reject(new Error('بارگذاری اولیه ویدیو ناموفق بود'))
        setTimeout(() => reject(new Error('تایم‌اوت بارگذاری ویدیو')), 25000)
        video!.load()
      })

      const rawW = video.videoWidth || 1080
      const rawH = video.videoHeight || 1920
      const duration = video.duration || 0

      let targetW = rawW
      let targetH = rawH

      if (styleConfig.aspectRatio === '9:16') {
        targetW = 1080
        targetH = 1920
      } else if (styleConfig.aspectRatio === '16:9') {
        targetW = 1920
        targetH = 1080
      } else if (styleConfig.aspectRatio === '1:1') {
        targetW = 1080
        targetH = 1080
      } else if (styleConfig.aspectRatio === '4:5') {
        targetW = 1080
        targetH = 1350
      }

      const clamped = clampCanvasDimensions(targetW, targetH, 1920)
      const outW = clamped.width
      const outH = clamped.height

      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) throw new Error('عدم دسترسی به بستر Canvas')

      let isWebCodecsSupported = false
      let mp4Mod: any = null

      if (typeof (window as any).VideoEncoder === 'function') {
        try {
          const support = await (window as any).VideoEncoder.isConfigSupported({
            codec: 'avc1.4d002a',
            width: outW,
            height: outH,
            bitrate: 3_000_000,
            framerate: FPS,
          })
          if (support?.supported) {
            mp4Mod = await import(/* webpackIgnore: true */ 'https://esm.sh/mp4-muxer@5.1.4').catch(() => null)
            if (mp4Mod) isWebCodecsSupported = true
          }
        } catch {
          isWebCodecsSupported = false
        }
      }

      // فال‌بک MediaRecorder
      if (!isWebCodecsSupported) {
        if (typeof MediaRecorder === 'undefined') {
          throw new Error('مرورگر شما امکان ضبط و خروجی ویدیو را پشتیبانی نمی‌کند. لطفاً از مرورگر جدیدتر (مانند Chrome یا Safari نسخه ۱۴ به بالا) استفاده فرمایید.')
        }

        setStatus('رندر با موتور پشتیبان مرورگر...')
        let supportedMime = 'video/webm'
        if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
          supportedMime = 'video/mp4;codecs=avc1'
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          supportedMime = 'video/mp4'
        }

        const stream = canvas.captureStream(FPS)
        const recorder = new MediaRecorder(stream, { mimeType: supportedMime })
        const chunks: Blob[] = []

        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
        recorder.start()

        const totalFrames = Math.ceil(duration * FPS)
        for (let f = 0; f < totalFrames; f++) {
          if (abortRef.current) { recorder.stop(); throw new Error('لغو توسط کاربر') }
          const curTime = f / FPS
          await seekTo(video, curTime)
          renderStudioFrame({ ctx, canvasWidth: outW, canvasHeight: outH, video, currentTime: curTime, segments, style: styleConfig })
          setProgress(Math.round((f / totalFrames) * 90))
        }

        recorder.stop()
        await new Promise((res) => { recorder.onstop = res })
        const ext = supportedMime.includes('mp4') ? 'mp4' : 'webm'
        const outBlob = new Blob(chunks, { type: supportedMime })
        const dlUrl = URL.createObjectURL(outBlob)
        const a = document.createElement('a')
        a.href = dlUrl
        a.download = `${baseName}.subtitled.${ext}`
        document.body.appendChild(a)
        a.click()
        a.remove()
        setProgress(100)
        setStatus('✅ آماده دانلود!')
        return
      }

      // مسیر WebCodecs با رفع قطعی Race Condition
      const MuxerClass = mp4Mod.Muxer || mp4Mod.default?.Muxer
      const TargetClass = mp4Mod.ArrayBufferTarget || mp4Mod.default?.ArrayBufferTarget
      const target = new TargetClass()
      const muxer = new MuxerClass({
        target,
        video: { codec: 'avc', width: outW, height: outH },
        fastStart: 'in-memory',
      })

      const VideoFrameClass = (window as any).VideoFrame
      const encoder = new (window as any).VideoEncoder({
        output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
        error: (e: any) => console.error('[Encoder Error]', e),
      })

      encoder.configure({
        codec: 'avc1.4d002a',
        width: outW,
        height: outH,
        bitrate: Math.round(clamp(outW * outH * 2.4, 1_800_000, 5_500_000)),
        framerate: FPS,
      })

      const totalFrames = Math.ceil(duration * FPS)
      const frameDurationMicro = 1_000_000 / FPS
      setStatus('در حال رندر و پردازش فریم‌ها...')

      for (let f = 0; f < totalFrames; f++) {
        if (abortRef.current) throw new Error('عملیات توسط کاربر لغو شد.')

        const curTime = f / FPS
        await seekTo(video, curTime)

        renderStudioFrame({
          ctx,
          canvasWidth: outW,
          canvasHeight: outH,
          video,
          currentTime: curTime,
          segments,
          style: styleConfig,
        })

        const frame = new VideoFrameClass(canvas, {
          timestamp: Math.round(f * frameDurationMicro),
          duration: Math.round(frameDurationMicro),
        })

        // بستن ایمن فریم تنها پس از تحویل قطعی به انکودر
        encoder.encode(frame, { keyFrame: f % FPS === 0 })
        await encoder.flush()
        frame.close()

        setProgress(Math.round((f / totalFrames) * 85))
      }

      await encoder.flush()
      muxer.finalize()

      setStatus('در حال ادغام صدای اصلی با ویدیو...')
      setProgress(88)

      const ffmpeg = await getOrInitFFmpeg()
      await ffmpeg.writeFile('sub_v.mp4', new Uint8Array(target.buffer))
      await ffmpeg.writeFile('src_a.mp4', new Uint8Array(await sharedBlob.arrayBuffer()))

      setProgress(94)
      await ffmpeg.exec([
        '-i', 'sub_v.mp4',
        '-i', 'src_a.mp4',
        '-map', '0:v:0',
        '-map', '1:a:0?',
        '-c:v', 'copy',
        '-c:a', 'copy',
        '-movflags', '+faststart',
        'final.mp4',
      ])

      const finalData = await ffmpeg.readFile('final.mp4')
      const finalBlob = new Blob([finalData], { type: 'video/mp4' })

      setProgress(100)
      setStatus('✅ آماده دانلود!')

      const dlUrl = URL.createObjectURL(finalBlob)
      const a = document.createElement('a')
      a.href = dlUrl
      a.download = `${baseName}.subtitled.mp4`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(dlUrl), 5000)

    } catch (err: any) {
      if (!abortRef.current) {
        alert('خطا در رندر: ' + (err?.message || err))
        setStatus('❌ خطا در رندر')
      }
    } finally {
      if (video?.parentNode) video.parentNode.removeChild(video)
      setExporting(false)
    }
  }

  return { exporting, progress, status, exportVideo, cancelExport }
}
