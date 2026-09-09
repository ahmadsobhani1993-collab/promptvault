'use client'

import { useRef, useState } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { wrapText, easeOutBack, loadFont, type Seg, type Style } from '@/lib/subtitle-studio'

type Props = {
  videoUrl: string
  baseName: string
  segments: Seg[]
  style: Style
}

export default function SubtitleVideoExport({ videoUrl, baseName, segments, style }: Props) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const styleRef = useRef(style)
  styleRef.current = style
  const segRef = useRef(segments)
  segRef.current = segments

  const exportVideo = async () => {
    if (exporting || !videoUrl) return
    setExporting(true)
    setProgress(0)
    setStatus('آماده‌سازی...')

    try {
      // ۱. ساخت ویدیو المنت
      setStatus('لود ویدیو...')
      const video = document.createElement('video')
      video.src = videoUrl
      video.playsInline = true
      video.muted = true
      video.crossOrigin = 'anonymous'
      document.body.appendChild(video)

      await new Promise((res, rej) => {
        video.onloadeddata = () => res(null)
        video.onerror = () => rej(new Error('لود ویدیو شکست خورد'))
        setTimeout(() => rej(new Error('تایم‌اوت')), 15000)
      })

      const W = video.videoWidth || 1920
      const H = video.videoHeight || 1080
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas failed')

      setStatus('لود فونت...')
      await loadFont(styleRef.current?.fontId || 'Vazirmatn')

      // . ضبط ویدیو با Canvas
      setStatus('رندر فریم‌ها...')
      const stream = canvas.captureStream(30)
      
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
        videoBitsPerSecond: 8000000 
      })
      
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunks.push(e.data)
      }

      const renderFrame = () => {
        const t = video.currentTime
        const seg = segRef.current.find(s => t >= s.start && t <= s.end)

        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, W, H)
        ctx.drawImage(video, 0, 0, W, H)

        if (seg) {
          const s2 = styleRef.current
          const prog = Math.min(1, (t - seg.start) / Math.max(0.1, seg.end - seg.start))
          
          let scale = 1
          if (seg.fx === 'pop') scale = easeOutBack(prog)
          if (seg.fx === 'zoomIn') scale = 0.8 + 0.35 * prog
          if (seg.fx === 'zoomOut') scale = 1.15 - 0.35 * prog

          const fontSize = Math.max(10, Math.round((s2.size / 100) * H * scale))
          ctx.font = `700 ${fontSize}px "${s2.fontId || 'Vazirmatn'}"`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'

          const lines = wrapText(ctx, seg.text, W * 0.9)
          const lh = fontSize * 1.5
          const totalH = lines.length * lh
          const y = H - H * 0.1 - totalH / 2

          if (s2.bgOpacity > 0) {
            ctx.fillStyle = `rgba(0,0,0,${s2.bgOpacity})`
            const maxW = Math.max(...lines.map(l => ctx.measureText(l).width))
            ctx.fillRect(W/2 - maxW/2 - 10, y - totalH/2 - 10, maxW + 20, totalH + 20)
          }

          lines.forEach((line, i) => {
            if (s2.outline) {
              ctx.strokeStyle = '#000'
              ctx.lineWidth = Math.max(2, fontSize * 0.1)
              ctx.strokeText(line, W/2, y + i * lh)
            }
            ctx.fillStyle = s2.color
            ctx.fillText(line, W/2, y + i * lh)
          })
        }

        setProgress(video.duration ? (video.currentTime / video.duration) * 50 : 0)

        if (!video.ended) {
          requestAnimationFrame(renderFrame)
        }
      }

      await video.play()
      await new Promise(r => setTimeout(r, 300))
      recorder.start(1000)
      requestAnimationFrame(renderFrame)

      await new Promise(r => { video.onended = r })
      await new Promise(r => setTimeout(r, 500))
      recorder.stop()
      
      setProgress(60)
      setStatus('تبدیل به MP4...')

      // . تبدیل WebM به MP4 با FFmpeg.wasm (در مرورگر)
      const ffmpeg = new FFmpeg()
      
      ffmpeg.on('progress', ({ progress: p }) => {
        setProgress(60 + Math.round(p * 40))
      })

      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
      await ffmpeg.load({
        coreURL: await fetchFile(`${baseURL}/ffmpeg-core.js`),
        wasmURL: await fetchFile(`${baseURL}/ffmpeg-core.wasm`),
      })

      const webmBlob = new Blob(chunks, { type: 'video/webm' })
      await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob))

      await ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        'output.mp4'
      ])

      const mp4Data = await ffmpeg.readFile('output.mp4')
      const mp4Blob = new Blob([mp4Data], { type: 'video/mp4' })

      // ۴. دانلود
      setStatus('دانلود...')
      const url = URL.createObjectURL(mp4Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${baseName}.subtitled.mp4`
      a.click()

      setTimeout(() => {
        URL.revokeObjectURL(url)
        ffmpeg.deleteFile('input.webm')
        ffmpeg.deleteFile('output.mp4')
      }, 5000)

      document.body.removeChild(video)
      setStatus('✅ کامل شد!')
      
    } catch (e: any) {
      console.error('[Export]', e)
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
