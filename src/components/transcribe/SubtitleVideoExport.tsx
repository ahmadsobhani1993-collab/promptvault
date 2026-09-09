'use client'

import { useRef, useState } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { wrapText, easeOutBack, loadFont, type Seg, type Style } from '@/lib/subtitle-studio'

type Props = {
  videoUrl: string
  baseName: string
  segments: Seg[]
  style?: Style
}

const DEFAULT_STYLE: Style = {
  size: 5,
  color: '#ffffff',
  bgOpacity: 0.6,
  outline: true,
  fontId: 'Vazirmatn',
  x: 50,
  y: 90,
  hlColor: '#f59e0b',
  karaoke: false
} as any

export default function SubtitleVideoExport({ videoUrl, baseName, segments, style }: Props) {
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
    setStatus('آماده‌سازی...')

    try {
      const video = document.createElement('video')
      video.src = videoUrl
      video.playsInline = true
      video.muted = true
      video.crossOrigin = 'anonymous'
      video.style.position = 'absolute'
      video.style.left = '-9999px'
      video.style.top = '-9999px'
      document.body.appendChild(video)

      await new Promise((res, rej) => {
        video.onloadedmetadata = () => {
          console.log('[Export] Metadata loaded:', video.videoWidth, 'x', video.videoHeight, 'Duration:', video.duration)
          res(null)
        }
        video.onerror = () => rej(new Error('لود ویدیو شکست خورد'))
        setTimeout(() => rej(new Error('تایم‌اوت لود')), 15000)
      })

      const W = video.videoWidth || 1920
      const H = video.videoHeight || 1080
      const duration = video.duration || 60
      
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: false })
      if (!ctx) throw new Error('Canvas context failed')

      setStatus('لود فونت...')
      await loadFont(styleRef.current?.fontId || 'Vazirmatn')

      setStatus('شروع رندر...')
      const stream = canvas.captureStream(60)
      
      try {
        const audioCtx = new AudioContext()
        const src = audioCtx.createMediaElementSource(video)
        const dest = audioCtx.createMediaStreamDestination()
        src.connect(dest)
        dest.stream.getAudioTracks().forEach(t => stream.addTrack(t))
      } catch (e) {
        console.warn('No audio:', e)
      }

      const recorder = new MediaRecorder(stream, { 
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 25_000_000  // کاهش بیت‌ریت برای جلوگیری از crash
      })
      
      const chunks: Blob[] = []
      recorder.ondataavailable = (e: any) => {
        if (e && e.data && typeof e.data.size === 'number' && e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      let frameCount = 0
      const renderFrame = () => {
        const t = video.currentTime
        const seg = segRef.current.find(s => t >= s.start && t <= s.end)

        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, W, H)
        ctx.drawImage(video, 0, 0, W, H)

        if (seg) {
          const s2 = styleRef.current || DEFAULT_STYLE
          const prog = Math.min(1, (t - seg.start) / Math.max(0.1, seg.end - seg.start))
          
          let scale = 1
          if (seg.fx === 'pop') scale = easeOutBack(prog)
          if (seg.fx === 'zoomIn') scale = 0.8 + 0.35 * prog
          if (seg.fx === 'zoomOut') scale = 1.15 - 0.35 * prog

          // ✅ محاسبه سایز فونت بر اساس عرض ویدیو (هماهنگ با ادیتور)
          const fontSize = Math.max(24, Math.round((s2.size / 100) * W * scale))
          ctx.font = `700 ${fontSize}px "${s2.fontId || 'Vazirmatn'}"`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'

          const lines = wrapText(ctx, seg.text, W * 0.9)
          const lh = fontSize * 1.5
          const totalH = lines.length * lh

          // ✅ محاسبه موقعیت با محدودیت سخت‌گیرانه
          const anchorX = s2.x != null ? (s2.x / 100) * W : W / 2
          const anchorY = s2.y != null ? (s2.y / 100) * H : H - H * 0.1

          const maxLineWidth = Math.max(...lines.map(l => ctx.measureText(l).width))
          const padding = fontSize * 0.5
          
          // clamping برای جلوگیری از خروج
          const minX = maxLineWidth / 2 + padding
          const maxX = W - maxLineWidth / 2 - padding
          const finalX = Math.max(minX, Math.min(maxX, anchorX))

          const minY = totalH / 2 + padding
          const maxY = H - totalH / 2 - padding
          const finalY = Math.max(minY, Math.min(maxY, anchorY))

          // رسم
          if (s2.bgOpacity > 0) {
            ctx.fillStyle = `rgba(0,0,0,${s2.bgOpacity})`
            ctx.fillRect(finalX - maxLineWidth / 2 - padding / 2, finalY - totalH / 2 - padding / 2, maxLineWidth + padding, totalH + padding)
          }

          lines.forEach((line, i) => {
            const y = finalY + (i - (lines.length - 1) / 2) * lh
            if (s2.outline) {
              ctx.strokeStyle = '#000'
              ctx.lineWidth = Math.max(2, fontSize * 0.1)
              ctx.strokeText(line, finalX, y)
            }
            ctx.fillStyle = s2.color
            ctx.fillText(line, finalX, y)
          })
        }

        frameCount++
        setProgress((t / duration) * 50)
      }

      console.log('[Export] Starting playback...')
      await video.play()
      
      recorder.start(1000)
      console.log('[Export] Recorder started')

      const renderInterval = setInterval(() => {
        try {
          renderFrame()
        } catch (err) {
          console.error('[Export] Render error:', err)
        }
        
        if (video.ended) {
          console.log('[Export] Video ended, frameCount:', frameCount)
          clearInterval(renderInterval)
        }
      }, 1000 / 60)

      await new Promise((res) => {
        video.onended = () => {
          console.log('[Export] onended fired')
          res(null)
        }
        const maxTime = duration + 2
        const checkTimeout = setInterval(() => {
          if (video.currentTime >= maxTime) {
            console.log('[Export] Timeout reached')
            clearInterval(checkTimeout)
            res(null)
          }
        }, 1000)
      })

      clearInterval(renderInterval)
      await new Promise(r => setTimeout(r, 500))
      recorder.stop()
      console.log('[Export] Recorder stopped, chunks:', chunks.length, 'frames:', frameCount)
      
      setProgress(60)
      setStatus('تبدیل به MP4 (این مرحله ممکن است چند دقیقه طول بکشد)...')

      // تبدیل با FFmpeg
      const ffmpeg = new FFmpeg()
      
      ffmpeg.on('progress', ({ progress: p, time }) => {
        setProgress(60 + Math.round(p * 40))
        console.log('[FFmpeg] Progress:', p, 'time:', time)
      })

      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message)
      })

      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
      const coreBlob = await (await fetch(`${baseURL}/ffmpeg-core.js`)).blob()
      const wasmBlob = await (await fetch(`${baseURL}/ffmpeg-core.wasm`)).blob()
      
      await ffmpeg.load({
        coreURL: URL.createObjectURL(coreBlob),
        wasmURL: URL.createObjectURL(wasmBlob),
      })

      const webmBlob = new Blob(chunks, { type: 'video/webm' })
      const arrayBuffer = await webmBlob.arrayBuffer()
      await ffmpeg.writeFile('input.webm', new Uint8Array(arrayBuffer))

      console.log('[FFmpeg] Starting conversion...')
      await ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'libx264',
        '-preset', 'medium',  // کاهش از slow به medium برای سرعت بیشتر
        '-crf', '23',         // افزایش از 18 به 23 برای حجم کمتر
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        'output.mp4'
      ])

      const mp4Data = await ffmpeg.readFile('output.mp4') as Uint8Array
      const mp4Blob = new Blob([mp4Data], { type: 'video/mp4' })

      setStatus('دانلود...')
      const url = URL.createObjectURL(mp4Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${baseName}.subtitled.mp4`
      a.click()

      setTimeout(() => {
        URL.revokeObjectURL(url)
        ffmpeg.deleteFile('input.webm').catch(() => {})
        ffmpeg.deleteFile('output.mp4').catch(() => {})
      }, 5000)

      document.body.removeChild(video)
      setStatus('✅ کامل شد!')
      
    } catch (e: any) {
      console.error('[Export Error]', e)
      alert('❌ خطا: ' + (e?.message || 'Unknown'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/90 z-50">
      <button
        onClick={exportVideo}
        disabled={exporting}
        className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white font-bold rounded-xl transition-all"
      >
        {exporting ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm">{status}</span>
            <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-white h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs">{Math.round(progress)}%</span>
          </div>
        ) : (
          ' خروجی MP4 با زیرنویس'
        )}
      </button>
    </div>
  )
}
