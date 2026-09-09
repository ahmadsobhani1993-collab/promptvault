'use client'

import { useRef, useState } from 'react'
import { wrapText, easeOutBack, loadFont, type Seg, type Style } from '@/lib/subtitle-studio'

type Props = {
  videoUrl: string
  baseName: string
  segments: Seg[]
  style: Style
}

export default function SubtitleVideoExport({ videoUrl, baseName, segments, style }: Props) {
  const [exporting, setExporting] = useState(false)
  const [expProg, setExpProg] = useState(0)
  const styleRef = useRef(style)
  styleRef.current = style
  const segRef = useRef(segments)
  segRef.current = segments

  const exportVideo = async () => {
    if (exporting || !videoUrl) return
    setExporting(true); setExpProg(0)
    
    try {
      // ساخت video element
      const video = document.createElement('video')
      video.src = videoUrl
      video.playsInline = true
      video.muted = true
      video.crossOrigin = 'anonymous'
      document.body.appendChild(video)

      // صبر برای لود
      await new Promise((res, rej) => {
        video.onloadeddata = () => res(null)
        video.onerror = () => rej(new Error('Video load failed'))
        setTimeout(() => rej(new Error('Load timeout')), 10000)
      })

      const W = video.videoWidth || 1920
      const H = video.videoHeight || 1080
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context failed')

      // لود فونت
      await loadFont(styleRef.current?.fontId || 'Vazirmatn')

      // استفاده از captureStream
      const stream = canvas.captureStream(30)
      
      // اضافه کردن صدا اگر وجود دارد
      try {
        const audioCtx = new AudioContext()
        const src = audioCtx.createMediaElementSource(video)
        const dest = audioCtx.createMediaStreamDestination()
        src.connect(dest)
        dest.stream.getAudioTracks().forEach(track => stream.addTrack(track))
      } catch (e) {
        console.warn('[Export] No audio:', e)
      }

      // پیدا کردن MIME type پشتیبانی شده
      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4'
      ]
      const mimeType = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || ''
      console.log('[Export] MIME:', mimeType)

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5000000
      })

      const chunks: Blob[] = []
      
      recorder.ondataavailable = (e) => {
        console.log('[Export] Data available:', e.data?.size)
        if (e.data && e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      const promise = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          console.log('[Export] Recorder stopped, chunks:', chunks.length)
          if (chunks.length === 0) {
            reject(new Error('No data recorded'))
            return
          }
          const blob = new Blob(chunks, { type: mimeType || 'video/webm' })
          resolve(blob)
        }
        recorder.onerror = (e: any) => {
          console.error('[Export] Recorder error:', e)
          reject(new Error(e.error?.name || 'Recorder error'))
        }
      })

      // شروع ریکورد
      recorder.start(1000)

      // تابع رندر فریم
      const renderFrame = () => {
        const t = video.currentTime
        const seg = segRef.current.find((s) => t >= s.start && t <= s.end)
        
        // پاک کردن canvas
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, W, H)
        
        // رسم ویدیو
        ctx.drawImage(video, 0, 0, W, H)

        if (seg) {
          const s2 = styleRef.current
          const progress = Math.min(1, (t - seg.start) / Math.max(0.1, seg.end - seg.start))
          
          let scale = 1
          if (seg.fx === 'pop') scale = easeOutBack(progress)
          if (seg.fx === 'zoomIn') scale = 0.8 + 0.35 * progress
          if (seg.fx === 'zoomOut') scale = 1.15 - 0.35 * progress
          
          const fontSize = Math.max(10, Math.round((s2.size / 100) * H * scale))
          ctx.font = `700 ${fontSize}px "${s2.fontId || 'Vazirmatn'}"`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          
          const lines = wrapText(ctx, seg.text, W * 0.9)
          const lineHeight = fontSize * 1.5
          const totalHeight = lines.length * lineHeight
          const y = H - H * 0.1 - totalHeight / 2
          
          // رسم background
          if (s2.bgOpacity > 0) {
            ctx.fillStyle = `rgba(0,0,0,${s2.bgOpacity})`
            const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width))
            ctx.fillRect(W/2 - maxWidth/2 - 10, y - totalHeight/2 - 10, maxWidth + 20, totalHeight + 20)
          }
          
          // رسم متن
          lines.forEach((line, i) => {
            if (s2.outline) {
              ctx.strokeStyle = '#000'
              ctx.lineWidth = Math.max(2, fontSize * 0.1)
              ctx.strokeText(line, W/2, y + i * lineHeight)
            }
            ctx.fillStyle = s2.color
            ctx.fillText(line, W/2, y + i * lineHeight)
          })
        }
        
        setExpProg(video.duration ? video.currentTime / video.duration : 0)
        
        if (!video.ended) {
          requestAnimationFrame(renderFrame)
        }
      }

      // شروع پخش و رندر
      await video.play()
      await new Promise(r => setTimeout(r, 300))
      requestAnimationFrame(renderFrame)
      
      // صبر برای پایان
      await new Promise(r => { video.onended = r })
      
      // صبر برای تکمیل ریکورد
      await new Promise(r => setTimeout(r, 500))
      recorder.stop()
      
      // دریافت blob
      const blob = await promise
      
      // دانلود
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${baseName}.subtitled.${ext}`
      a.click()
      
      // cleanup
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      document.body.removeChild(video)
      
    } catch (e: any) {
      console.error('[Export Error]', e)
      alert('❌ خطا: ' + (e?.message || 'Unknown error'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 z-50">
      <button
        onClick={exportVideo}
        disabled={exporting}
        className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {exporting ? `در حال رندر... ${Math.round(expProg * 100)}%` : '📹 خروجی ویدیو با زیرنویس'}
      </button>
    </div>
  )
}
