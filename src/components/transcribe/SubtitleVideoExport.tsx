'use client'

import { useState, useRef, useCallback } from 'react'
import { loadFFmpeg } from '@/lib/video-extract' // مسیر فایل utility که فرستادی

type StudioSegment = { id: string; start: number; end: number; text: string }
type StudioStyleConfig = {
  fontFamily: string
  fontSize: number
  color: string
  bgColor: string
  bgOpacity: number
  align?: 'right' | 'center' | 'left'
  [key: string]: any
}

type Props = {
  videoUrl: string
  sourceFile?: File | null
  segments: StudioSegment[]
  styleConfig: StudioStyleConfig
  baseName: string
}

export default function SubtitleVideoExport({ videoUrl, sourceFile, segments, styleConfig, baseName }: Props) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stageText, setStageText] = useState('')
  const cancelRef = useRef(false)

  const drawFrame = useCallback((ctx: CanvasRenderingContext2D, video: HTMLVideoElement, time: number, W: number, H: number) => {
    ctx.drawImage(video, 0, 0, W, H)
    const seg = segments.find(s => time >= s.start && time <= s.end)
    if (!seg) return

    ctx.save()
    ctx.font = `bold ${styleConfig.fontSize}px "${styleConfig.fontFamily}", sans-serif`
    ctx.textAlign = styleConfig.align || 'center'
    ctx.textBaseline = 'bottom'
    
    const lines = seg.text.split('\n')
    const lineHeight = styleConfig.fontSize * 1.4
    const totalHeight = lines.length * lineHeight
    const x = W / 2
    const y = H - (H * 0.15) - totalHeight

    // پس‌زمینه
    if (styleConfig.bgOpacity > 0) {
      const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width))
      ctx.fillStyle = styleConfig.bgColor || `rgba(0,0,0,${styleConfig.bgOpacity})`
      ctx.fillRect(x - maxWidth / 2 - 10, y - 10, maxWidth + 20, totalHeight + 20)
    }

    // متن
    ctx.fillStyle = styleConfig.color || '#FFFFFF'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = styleConfig.fontSize * 0.08
    lines.forEach((line, i) => {
      const ly = y + (i + 1) * lineHeight
      ctx.strokeText(line, x, ly)
      ctx.fillText(line, x, ly)
    })
    ctx.restore()
  }, [segments, styleConfig])

  const handleExport = async () => {
    if (!videoUrl || exporting) return
    setExporting(true)
    setProgress(0)
    setStageText('آماده‌سازی...')
    cancelRef.current = false

    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;'
    const video = document.createElement('video')
    video.src = videoUrl
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.muted = true // جلوگیری از پخش صدا حین رندر
    container.appendChild(video)
    document.body.appendChild(container)

    try {
      await new Promise<void>((res, rej) => {
        video.onloadedmetadata = () => res()
        video.onerror = () => rej(new Error('خطای بارگذاری ویدیو'))
      })

      const duration = video.duration || segments.reduce((max, s) => Math.max(max, s.end), 0)
      const W = video.videoWidth || 1080
      const H = video.videoHeight || 1920
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })!
      const stream = canvas.captureStream(30)

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9', videoBitsPerSecond: 15_000_000 })
      const chunks: Blob[] = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      
      recorder.start(250)
      video.currentTime = 0
      await video.play()

      // فاز ۱: رندر Canvas
      await new Promise<void>(resolve => {
        const startTime = Date.now()
        const onFrame = (_: number, meta: { mediaTime: number }) => {
          if (cancelRef.current || meta.mediaTime >= duration || (Date.now() - startTime) > duration * 1000 + 2000) {
            resolve()
            return
          }
          drawFrame(ctx, video, meta.mediaTime, W, H)
          setProgress(Math.min(50, Math.round((meta.mediaTime / duration) * 50)))
          setStageText(`رندر فریم‌ها...`)
          if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(onFrame)
        }
        if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(onFrame)
        else {
          const timer = setInterval(() => {
            if (cancelRef.current || video.currentTime >= duration) { clearInterval(timer); resolve(); return }
            drawFrame(ctx, video, video.currentTime, W, H)
            setProgress(Math.min(50, Math.round((video.currentTime / duration) * 50)))
          }, 33) // ~30fps fallback
        }
      })

      if (cancelRef.current) throw new Error('CANCELLED')
      recorder.stop()
      video.pause()
      await new Promise<void>(res => { recorder.onstop = () => res() })

      // فاز ۲: FFmpeg Muxing & CRF
      setStageText('فشرده‌سازی هوشمند (FFmpeg)...')
      setProgress(60)

      const finalBlob = await (async () => {
        const ff = await loadFFmpeg()
        const rawName = `raw_${Date.now()}.webm`
        const outName = `final_${Date.now()}.mp4`
        
        await ff.writeFile(rawName, new Uint8Array(await new Blob(chunks).arrayBuffer()))
        
        const args = ['-i', rawName, '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast']
        
        if (sourceFile) {
          const ext = sourceFile.name.match(/\.[^.]+$/)?.[0] || '.mp4'
          const srcName = `src_${Date.now()}${ext}`
          await ff.writeFile(srcName, new Uint8Array(await sourceFile.arrayBuffer()))
          args.push('-i', srcName, '-c:a', 'aac', '-b:a', '192k', '-map', '0:v:0', '-map', '1:a:0?', '-shortest')
        } else {
          args.push('-c:a', 'aac', '-b:a', '192k')
        }
        
        args.push(outName)
        await ff.exec(args)
        
        const data = await ff.readFile(outName)
        await ff.deleteFile(rawName).catch(() => {})
        if (sourceFile) await ff.deleteFile(`src_${Date.now()}${sourceFile.name.match(/\.[^.]+$/)?.[0] || '.mp4'}`).catch(() => {})
        await ff.deleteFile(outName).catch(() => {})
        
        return new Blob([data], { type: 'video/mp4' })
      })()

      if (cancelRef.current) throw new Error('CANCELLED')
      setProgress(100)
      setStageText('آماده دانلود!')

      const url = URL.createObjectURL(finalBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${baseName}_subtitled.mp4`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 5000)

    } catch (err: any) {
      if (err.message !== 'CANCELLED') {
        console.error(err)
        alert('خطا در خروجی: ' + (err.message || 'نامشخص'))
      }
    } finally {
      document.body.removeChild(container)
      setExporting(false)
      setStageText('')
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      {exporting ? (
        <div className="bg-stone-900/80 border border-amber-500/40 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-amber-400">{stageText}</span>
            <button onClick={() => { cancelRef.current = true; setExporting(false); setStageText('') }} className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded hover:bg-red-500/20">توقف</button>
          </div>
          <div className="h-2 w-full bg-stone-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-[10px] text-stone-400 text-center">{progress}%</div>
        </div>
      ) : (
        <button onClick={handleExport} className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold text-sm shadow-lg shadow-orange-500/20 hover:from-orange-400 active:scale-95 transition">
          شروع ساخت ویدیو با کیفیت بالا (FFmpeg)
        </button>
      )}
      <p className="text-[10px] text-stone-500 text-center">
        {sourceFile ? 'صدای اصلی فایل حفظ و با تصویر هماهنگ می‌شود.' : 'هشدار: بدون فایل اصلی، صدا ممکن است تولید نشود.'}
      </p>
    </div>
  )
}