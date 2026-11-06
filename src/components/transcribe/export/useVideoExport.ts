'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { loadFFmpeg } from '@/lib/video-extract'
import { ensureFontLoaded } from '@/lib/studio/font-loader'
import { renderStudioFrame } from '@/lib/studio/universal-renderer'
import { DEFAULT_STUDIO_STYLE, type StudioSegment, type StudioStyleConfig } from '@/lib/studio/unified-style'
import type { Seg, Style } from '@/lib/subtitle-studio'
import { useLocale } from '@/lib/use-locale'
import { L } from '@/lib/l'

export type ExportQuality = 'balanced' | 'high'

const HW_ENCODER_HEADROOM = 1.08

let ffmpegLock: Promise<any> = Promise.resolve()
function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const result = ffmpegLock.then(fn, fn)
  ffmpegLock = result.catch(() => {})
  return result
}

// در ffmpeg.wasm نسخه 0.12 تابع exec روی خطای ffmpeg معمولاً reject نمی‌کند و کد خروج غیرصفر برمی‌گرداند
async function execOk(ff: any, args: string[]): Promise<boolean> {
  try {
    const code = await ff.exec(args)
    return typeof code === 'number' ? code === 0 : true
  } catch {
    return false
  }
}

async function extractAudioSafe(ff: any, inputName: string, outputName: string, limitDuration?: number): Promise<boolean> {
  const durationArgs = limitDuration ? ['-t', String(limitDuration)] : []

  if (await execOk(ff, ['-i', inputName, '-map', '0:a:0', '-vn', '-c:a', 'copy', ...durationArgs, outputName])) {
    return true
  }
  await ff.deleteFile(outputName).catch(() => {})

  if (await execOk(ff, ['-i', inputName, '-map', '0:a:0', '-vn', '-c:a', 'aac', '-b:a', '192k', ...durationArgs, outputName])) {
    return true
  }
  await ff.deleteFile(outputName).catch(() => {})
  return false
}

// ترجیح می‌دهیم MediaRecorder مستقیم H.264/MP4 ضبط کند؛ در این حالت دیگر انکود سنگین libx264 در WASM لازم نیست.
function pickRecorderMime(): { mime: string; isMp4: boolean } {
  const mp4Candidates = [
    'video/mp4;codecs=avc1.640028',
    'video/mp4;codecs=avc1.4D4028',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1',
  ]
  const mp4 = mp4Candidates.find((t) => MediaRecorder.isTypeSupported(t))
  if (mp4) return { mime: mp4, isMp4: true }
  const webm = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') ? 'video/webm; codecs=vp9' : 'video/webm'
  return { mime: webm, isMp4: false }
}

function getRecordedVideoDuration(blob: Blob, fallbackDuration: number): Promise<number> {
  const url = URL.createObjectURL(blob)
  const probe = document.createElement('video')
  probe.preload = 'metadata'
  probe.src = url

  return new Promise<number>((resolve) => {
    let settled = false
    const cleanup = () => {
      if (settled) return false
      settled = true
      probe.removeAttribute('src')
      probe.load()
      URL.revokeObjectURL(url)
      return true
    }
    const timeout = window.setTimeout(() => {
      cleanup()
      resolve(fallbackDuration)
    }, 15000)
    probe.onloadedmetadata = () => {
      window.clearTimeout(timeout)
      const duration = probe.duration
      if (!cleanup()) return
      resolve(Number.isFinite(duration) && duration > 0 ? duration : fallbackDuration)
    }
    probe.onerror = () => {
      window.clearTimeout(timeout)
      if (cleanup()) resolve(fallbackDuration)
    }
  })
}

function normalizeExportStyle(style: StudioStyleConfig | Style): StudioStyleConfig {
  if ('aspectRatio' in style) return style
  return {
    ...DEFAULT_STUDIO_STYLE,
    fontFamily: style.fontId || DEFAULT_STUDIO_STYLE.fontFamily,
    fontSizePercent: Number(style.size) || DEFAULT_STUDIO_STYLE.fontSizePercent,
    textColor: style.color || DEFAULT_STUDIO_STYLE.textColor,
    activeWordColor: style.hlColor || DEFAULT_STUDIO_STYLE.activeWordColor,
    hasBg: style.bgOpacity > 0,
    bgOpacity: style.bgOpacity,
    hasTextStroke: style.outline,
    textStrokeWidth: style.outline ? DEFAULT_STUDIO_STYLE.textStrokeWidth : 0,
    positionXPercent: style.x ?? DEFAULT_STUDIO_STYLE.positionXPercent,
    positionYPercent: style.y ?? DEFAULT_STUDIO_STYLE.positionYPercent,
    hasActiveWordBg: style.karaoke,
    alignment: style.align ?? DEFAULT_STUDIO_STYLE.alignment,
  }
}

export function useVideoExport(sourceFile?: File | Blob | null) {
  const locale = useLocale()
  const translate = (fa: string, en: string) => L(locale, fa, en)
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
        try {
          await ff.writeFile(inName, new Uint8Array(await fileOrBlob.arrayBuffer()))
          const success = await extractAudioSafe(ff, inName, outAudio)
          if (success) preppedAudioRef.current = { name: outAudio, ready: true }
        } finally {
          await ff.deleteFile(inName).catch(() => {})
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

  const exportVideo = async (videoUrl: string, segments: Seg[], style: StudioStyleConfig | Style, baseName: string = 'video', quality: ExportQuality = 'balanced') => {
    if (!videoUrl || exporting) return
    const renderStyle = normalizeExportStyle(style)
    const renderSegments: StudioSegment[] = segments.map((segment) => ({
      ...segment,
      words: segment.words?.map((word) => ({ text: word.w, start: word.start, end: word.end })),
    }))
    setExporting(true)
    setProgress(0)
    setStageText(translate('آماده‌سازی لایه‌ها...', 'Preparing layers…'))
    cancelRef.current = false

    // ویدیو را کوچک ولی داخل صفحه نگه می‌داریم (نه -9999px) تا مرورگر رندرش را متوقف نکند
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;bottom:0;right:0;width:2px;height:2px;overflow:hidden;opacity:0.01;pointer-events:none;'
    const video = document.createElement('video')
    video.src = videoUrl
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.preload = 'auto'
    video.muted = true
    video.volume = 0
    container.appendChild(video)
    document.body.appendChild(container)

    let canvasStream: MediaStream | null = null
    let recorder: MediaRecorder | null = null
    let visibilityHandler: (() => void) | null = null

    try {
      const usedFonts = new Set<string>([renderStyle.fontFamily || 'Vazirmatn'])
      for (const watermark of renderStyle.watermarks ?? []) {
        if (watermark.type === 'text' && watermark.fontFamily) usedFonts.add(watermark.fontFamily)
      }
      await Promise.all([...usedFonts].map((family) => ensureFontLoaded(family, true)))
      await document.fonts.ready
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('خطا در بارگذاری اولیه ویدیو'))
      })
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve()
          video.onerror = () => reject(new Error('فریم ابتدایی ویدیو آماده نشد'))
        })
      }

      let duration = video.duration
      if (!duration || !Number.isFinite(duration) || duration <= 0) {
        duration = segments.length > 0 ? Math.max(...segments.map((s) => s.end)) : 10
      }

      let targetFps = 30
      try {
        const probeStream = (video as any).captureStream?.()
        const track = probeStream?.getVideoTracks?.()[0]
        if (track?.getSettings?.()?.frameRate && track.getSettings().frameRate > 45) targetFps = 60
        track?.stop()
        probeStream?.getTracks().forEach((t: MediaStreamTrack) => t.stop())
      } catch { targetFps = 30 }

      const ratio = renderStyle.aspectRatio || '16:9'
      let W: number, H: number
      if (ratio === '9:16') { W = 1080; H = 1920 }
      else if (ratio === '16:9') { W = 1920; H = 1080 }
      else if (ratio === '1:1') { W = 1080; H = 1080 }
      else if (ratio === '4:5') { W = 1080; H = 1350 }
      else { W = video.videoWidth || 1080; H = video.videoHeight || 1920 }

      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
      if (!ctx) throw new Error('امکان ایجاد Canvas وجود ندارد')

      canvasStream = canvas.captureStream(targetFps)
      const { mime, isMp4 } = pickRecorderMime()
      console.log('[EXPORT] recorder mime:', mime, '| direct MP4:', isMp4, '| normalizing frame timestamps')

      // بودجه‌ی بیت‌ریت بر اساس حجم فایل اصلی (همان منطق قبلی)
      const sizeFactor = quality === 'high' ? 1.1 : 1.03
      const knownSourceBytes = sourceFile?.size ?? 0
      const knownSourceKbps = knownSourceBytes > 0 && duration > 0
        ? (knownSourceBytes * 8) / duration / 1000
        : 0

      const bitsPerPixel = quality === 'high' ? 0.2 : 0.14
      const directBitrate = Math.min(
        24_000_000,
        Math.max(8_000_000, Math.round(W * H * Math.min(targetFps, 30) * bitsPerPixel))
      )

      let videoBitrate: number
      if (knownSourceKbps > 0) {
        const totalKbps = Math.max(160, Math.floor(knownSourceKbps * sizeFactor))
        videoBitrate = Math.min(
          24_000_000,
          Math.max(quality === 'high' ? 10_000_000 : 7_000_000, Math.round(totalKbps * 1000 * HW_ENCODER_HEADROOM))
        )
      } else {
        videoBitrate = directBitrate
      }

      const rec = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond: videoBitrate })
      recorder = rec
      const rawChunks: Blob[] = []
      rec.ondataavailable = (e) => { if (e.data?.size > 0) rawChunks.push(e.data) }
      const recorderStopped = new Promise<void>((resolve) => { rec.onstop = () => resolve() })

      // اگر کاربر تب را عوض کرد، به‌جای قفل شدن، ضبط و ویدیو را موقتاً متوقف می‌کنیم
      visibilityHandler = () => {
        if (rec.state === 'inactive') return
        if (document.hidden) {
          try { video.pause() } catch {}
          if (rec.state === 'recording') { try { rec.pause() } catch {} }
          setStageText(translate('رندر متوقف شد؛ برای ادامه به این تب برگردید', 'Rendering paused; return to this tab to continue.'))
        } else {
          if (rec.state === 'paused') { try { rec.resume() } catch {} }
          video.play().catch(() => {})
        }
      }
      document.addEventListener('visibilitychange', visibilityHandler)

      video.currentTime = 0
      renderStudioFrame({
        ctx,
        canvasWidth: W,
        canvasHeight: H,
        video,
        currentTime: 0,
        segments: renderSegments,
        style: renderStyle,
      })
      rec.start(250)
      await video.play()

      // حلقه‌ی رندر: پایان آن فقط به callback فریم وابسته نیست
      await new Promise<void>((resolve, reject) => {
        let settled = false
        let watchdog = 0
        let lastTime = video.currentTime
        let lastAdvance = Date.now()
        let lastUiSecond = -1
        const hasRvfc = typeof (video as any).requestVideoFrameCallback === 'function'

        const cleanup = () => {
          settled = true
          window.clearInterval(watchdog)
          video.removeEventListener('ended', onEnded)
          video.removeEventListener('error', onVideoError)
        }
        const finish = () => { if (settled) return; cleanup(); resolve() }
        const fail = (msg: string) => { if (settled) return; cleanup(); reject(new Error(msg)) }

        const recordShare = 50
        const paint = (mediaTime: number) => {
          renderStudioFrame({
            ctx,
            canvasWidth: W,
            canvasHeight: H,
            video,
            currentTime: mediaTime,
            segments: renderSegments,
            style: renderStyle,
          })
          const sec = Math.floor(mediaTime)
          if (sec !== lastUiSecond) {
            lastUiSecond = sec
            setProgress(Math.min(recordShare, Math.round((mediaTime / duration) * recordShare)))
            setStageText(translate(`رندر کانویس (${Math.max(0, Math.ceil(duration - mediaTime))}s باقی‌مانده)`, `Rendering frames (${Math.max(0, Math.ceil(duration - mediaTime))}s remaining)`))
          }
        }

        const onEnded = () => {
          try { paint(Math.min(video.currentTime, duration)) } catch {}
          finish()
        }
        const onVideoError = () => fail('خطا در پخش ویدیو هنگام رندر')
        video.addEventListener('ended', onEnded)
        video.addEventListener('error', onVideoError)

        watchdog = window.setInterval(() => {
          if (cancelRef.current || video.ended || video.currentTime >= duration - 0.05) { finish(); return }
          // وقتی عمداً متوقف شده (تب مخفی) کنترل گیر‌کردن غیرفعال است
          if (video.paused || document.hidden) { lastAdvance = Date.now(); return }
          if (video.currentTime > lastTime + 0.001) {
            lastTime = video.currentTime
            lastAdvance = Date.now()
          } else if (Date.now() - lastAdvance > 20000) {
            fail('پخش ویدیو متوقف شد (بیش از ۲۰ ثانیه فریم جدیدی نیامد).')
          }
        }, 500)

        if (hasRvfc) {
          const onFrame = (_now: DOMHighResTimeStamp, metadata: { mediaTime: number }) => {
            if (settled) return
            paint(metadata.mediaTime)
            ;(video as any).requestVideoFrameCallback(onFrame)
          }
          ;(video as any).requestVideoFrameCallback(onFrame)
        } else {
          const loop = () => {
            if (settled) return
            paint(video.currentTime)
            requestAnimationFrame(loop)
          }
          requestAnimationFrame(loop)
        }
      })

      if (visibilityHandler) { document.removeEventListener('visibilitychange', visibilityHandler); visibilityHandler = null }

      if (cancelRef.current) { try { rec.stop() } catch {}; video.pause(); canvasStream?.getTracks().forEach(t => t.stop()); return }
      rec.stop(); video.pause(); await recorderStopped
      if (cancelRef.current) return

      setStageText(translate('ادغام صدا و ساخت فایل نهایی...', 'Combining audio and creating the final file…'))
      setProgress(55)

      const finalBlob = await runExclusive(async () => {
        const ff = await loadFFmpeg()
        let workingSource = sourceFile
        if (!workingSource) {
          try { workingSource = await (await fetch(videoUrl)).blob() } catch {}
        }
        let audioFileToUse = preppedAudioRef.current?.name || null
        if (!audioFileToUse && workingSource) {
          const inExt = (workingSource as File)?.name?.match(/\.[^.]+$/)?.[0] || '.mp4'
          const tmpSrc = `src_late_${Date.now()}${inExt}`
          const tmpOut = `audio_late_${Date.now()}.m4a`
          await ff.writeFile(tmpSrc, new Uint8Array(await workingSource.arrayBuffer()))
          if (await extractAudioSafe(ff, tmpSrc, tmpOut, duration)) audioFileToUse = tmpOut
          await ff.deleteFile(tmpSrc).catch(() => {})
        }

        const rawBlob = new Blob(rawChunks, { type: mime })
        const recordedDuration = await getRecordedVideoDuration(rawBlob, duration)
        const videoTimeScale = duration / recordedDuration
        console.info('[EXPORT] timeline durations:', {
          sourceSeconds: duration,
          recordedSeconds: recordedDuration,
          videoTimeScale,
        })

        if (!audioFileToUse) {
          throw new Error(translate(
            'صدای ویدیوی اصلی استخراج نشد؛ برای جلوگیری از ساخت خروجی بی‌صدا، رندر متوقف شد.',
            'Could not extract the original audio. Export was stopped to avoid producing a silent video.'
          ))
        }

        const rawVideoName = `raw_${Date.now()}.${isMp4 ? 'mp4' : 'webm'}`
        const finalOutputName = `final_${Date.now()}.mp4`
        await ff.writeFile(rawVideoName, new Uint8Array(await rawBlob.arrayBuffer()))

        const audioArgs = audioFileToUse ? ['-i', audioFileToUse] : []
        const mapArgs = audioFileToUse ? ['-map', '0:v:0', '-map', '1:a:0'] : ['-map', '0:v:0']

        // بودجه‌ی بیت‌ریت (برای مسیر قدیمی ویدئو، و برای بیت‌ریت صدا در هر دو مسیر)
        const sourceBytes = workingSource?.size ?? 0
        const sourceAverageKbps = sourceBytes > 0 && duration > 0
          ? (sourceBytes * 8) / duration / 1000
          : (rawBlob.size * 8) / Math.max(duration, 0.1) / 1000
        const targetVideoBps = Math.min(
          24_000_000,
          Math.max(quality === 'high' ? 10_000_000 : 7_000_000, Math.round(sourceAverageKbps * sizeFactor * 1000))
        )

        // صدای خروجی را برای پخش موبایل/شبکه هم‌سطح و با بیت‌ریت کافی نگه می‌داریم.
        const audioOutputArgs = ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2']
        const audioCodecArgs = audioFileToUse
          ? ['-af', 'loudnorm=I=-16:TP=-1.5:LRA=11,asetpts=PTS-STARTPTS', ...audioOutputArgs]
          : []
        console.log('[EXPORT] source avg kbps:', Math.round(sourceAverageKbps), 'target video kbps:', Math.round(targetVideoBps / 1000), 'audio kbps:', audioFileToUse ? 192 : 0)

        // درصد پیشرفت را از لاگ خود ffmpeg (time=...) می‌خوانیم
        const muxBase = 55
        const muxSpan = 40
        const onLog = ({ message }: { message: string }) => {
          ffmpegLogs.push(message)
          if (ffmpegLogs.length > 100) ffmpegLogs.shift()
          const m = message.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/)
          if (m) {
            const t = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
            const r = Math.max(0, Math.min(1, t / duration))
            setProgress(muxBase + Math.round(r * muxSpan))
            setStageText(`${translate('فشرده‌سازی', 'Encoding')}... ${Math.round(r * 100)}%`)
          }
        }
        const ffmpegLogs: string[] = []
        ff.on('log', onLog)

        try {
          const videoCodecArgs = [
            '-vf', `fps=${targetFps},setpts=(PTS-STARTPTS)*${videoTimeScale.toFixed(8)}`,
            '-r', String(targetFps),
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-b:v', String(targetVideoBps),
            '-maxrate', String(Math.round(targetVideoBps * 1.25)),
            '-bufsize', String(targetVideoBps * 2),
            '-preset', 'veryfast',
          ]
          console.log('[EXPORT] ffmpeg start: CFR timestamp-normalized video + audio sync')

          const muxArgs = [
            '-fflags', '+genpts',
            '-i', rawVideoName,
            ...audioArgs,
            ...mapArgs,
            ...videoCodecArgs,
            ...audioCodecArgs,
            '-t', String(duration),
            '-avoid_negative_ts', 'make_zero',
            '-movflags', '+faststart',
            finalOutputName,
          ]
          let code = await ff.exec(muxArgs)
          if (typeof code === 'number' && code !== 0) {
            const firstFailure = ffmpegLogs.slice(-12).join('\n')
            const audioFilterFailure = /loudnorm|aresample|channel layout|format_out|Error reinitializing filters|Failed to inject frame/i.test(firstFailure)

            if (audioFileToUse && audioFilterFailure) {
              console.warn('[EXPORT] audio filter/format failed; retrying with explicit stereo output')
              ffmpegLogs.length = 0
              await ff.deleteFile(finalOutputName).catch(() => {})
              const retryAudioArgs = [
                '-af', 'dynaudnorm=f=150:g=15:p=0.95:m=10,asetpts=PTS-STARTPTS',
                ...audioOutputArgs,
              ]
              code = await ff.exec([
                ...muxArgs.slice(0, muxArgs.indexOf('-af')),
                ...retryAudioArgs,
                ...muxArgs.slice(muxArgs.indexOf('-af') + audioCodecArgs.length),
              ])

              if (typeof code === 'number' && code !== 0) {
                console.warn('[EXPORT] normalized audio retry failed; retrying with sync-only stereo AAC')
                ffmpegLogs.length = 0
                await ff.deleteFile(finalOutputName).catch(() => {})
                const safeAudioArgs = [
                  '-af', 'asetpts=PTS-STARTPTS',
                  ...audioOutputArgs,
                ]
                code = await ff.exec([
                  ...muxArgs.slice(0, muxArgs.indexOf('-af')),
                  ...safeAudioArgs,
                  ...muxArgs.slice(muxArgs.indexOf('-af') + audioCodecArgs.length),
                ])
              }
            }

            const latestFailure = ffmpegLogs.slice(-12).join('\n')
            const canCopyVideo = isMp4 &&
              Math.abs(recordedDuration - duration) <= Math.max(0.25, duration * 0.005) &&
              /Unknown encoder ['"]?libx264|Encoder not found/i.test(`${firstFailure}\n${latestFailure}`)

            if (typeof code === 'number' && code !== 0 && canCopyVideo && audioFileToUse) {
              console.warn('[EXPORT] libx264 is unavailable; retrying with the recorded MP4 video stream')
              ffmpegLogs.length = 0
              await ff.deleteFile(finalOutputName).catch(() => {})
              const copyArgs = [
                '-fflags', '+genpts',
                '-i', rawVideoName,
                ...audioArgs,
                ...mapArgs,
                '-c:v', 'copy',
                '-af', 'asetpts=PTS-STARTPTS',
                ...audioOutputArgs,
                '-t', String(duration),
                '-avoid_negative_ts', 'make_zero',
                '-movflags', '+faststart',
                finalOutputName,
              ]
              code = await ff.exec(copyArgs)
            }

            if (typeof code === 'number' && code !== 0) {
              const details = ffmpegLogs.slice(-12).join('\n')
              console.error('[EXPORT] FFmpeg failed', { code, firstFailure, details })
              throw new Error(`ffmpeg با کد ${code} متوقف شد${details ? `: ${details}` : ''}`)
            }
          }
          console.log('[EXPORT] ffmpeg finished')
        } finally {
          ff.off('log', onLog)
        }

        const finalData = await ff.readFile(finalOutputName)
        await ff.deleteFile(rawVideoName).catch(() => {})
        await ff.deleteFile(finalOutputName).catch(() => {})
        if (audioFileToUse && audioFileToUse !== preppedAudioRef.current?.name) await ff.deleteFile(audioFileToUse).catch(() => {})

        const bytes = finalData instanceof Uint8Array ? finalData : new TextEncoder().encode(String(finalData))
        return new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'video/mp4' })
      })

      if (cancelRef.current) return
      setProgress(100); setStageText(translate('آماده دانلود!', 'Ready to download!'))
      const url = URL.createObjectURL(finalBlob)
      const a = document.createElement('a')
      a.href = url; a.download = `${baseName}.subtitled.mp4`
      document.body.appendChild(a); a.click()
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 5000)
    } catch (e: any) {
      console.error('[EXPORT ERROR]', e)
      if (!cancelRef.current) alert(translate('خطا در رندر خروجی: ' + (e?.message || 'نامشخص'), 'Video export failed. Please try again.'))
    } finally {
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
      try { if (recorder && recorder.state !== 'inactive') recorder.stop() } catch {}
      try { video.pause() } catch {}
      canvasStream?.getTracks().forEach(t => t.stop())
      if (document.body.contains(container)) document.body.removeChild(container)
      setExporting(false); setStageText('')
    }
  }

  return { exporting, progress, stageText, exportVideo, cancelExport: () => { cancelRef.current = true; setExporting(false); setStageText('') } }
}