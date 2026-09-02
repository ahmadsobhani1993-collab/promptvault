'use client'

import { useRef, useState } from 'react'
import { MIME_CANDIDATES, wrapText, easeOutBack, loadFont, type Seg, type Style } from '@/lib/subtitle-studio'

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
      const video = document.createElement('video')
      video.src = videoUrl; video.playsInline = true
      await new Promise((res, rej) => { video.onloadedmetadata = () => res(null); video.onerror = () => rej(new Error('load failed')) })
      const W = video.videoWidth, H = video.videoHeight
      const canvas = document.createElement('canvas')
      canvas.width = W; canvas.height = H
      const ctx = canvas.getContext('2d')!
      const ac = new AudioContext()
      const srcNode = ac.createMediaElementSource(video)
      const dest = ac.createMediaStreamDestination()
      srcNode.connect(dest)
      await loadFont(styleRef.current.fontId)
      const stream = canvas.captureStream(30)
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))
      const mime = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) || ''
      const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: Math.max(8_000_000, W * H * 10) })
      const parts: Blob[] = []
      rec.ondataavailable = (e) => e.data.size && parts.push(e.data)
      const stopped = new Promise((res) => (rec.onstop = () => res(null)))
      rec.start(1000)
      const drawFrame = () => {
        const t = video.currentTime
        const seg = segRef.current.find((s) => t >= s.start && t <= s.end)
        const t01 = seg ? Math.min(1, Math.max(0, (t - seg.start) / Math.max(0.1, seg.end - seg.start))) : 0
        let vs = 1
        if (seg?.fx === 'zoomIn') vs = 1 + 0.12 * t01
        if (seg?.fx === 'zoomOut') vs = 1.12 - 0.12 * t01
        const sw = W / vs, sh = H / vs
        ctx.drawImage(video, (W - sw) / 2, (H - sh) / 2, sw, sh, 0, 0, W, H)
        if (!seg) return
        const s2 = styleRef.current
        let ts = 1
        if (seg.fx === 'pop') ts = easeOutBack(Math.min(1, (t - seg.start) / 0.35))
        if (seg.fx === 'zoomIn') ts = 0.8 + 0.35 * t01
        if (seg.fx === 'zoomOut') ts = 1.15 - 0.35 * t01
        let dx = 0
        if (seg.fx === 'slide') dx = (1 - Math.min(1, (t - seg.start) / 0.4)) * W * 0.1
        const px = Math.max(10, Math.round((s2.size / 100) * H * ts))
        const anchor = s2.x != null ? { x: (s2.x / 100) * W + dx, y: (s2.y / 100) * H } : { x: W / 2 + dx, y: H - H * 0.08 }
        ctx.textBaseline = 'middle'
        if (s2.karaoke && seg.words?.length) {
          ctx.font = `700 ${px}px "${s2.fontId}"`
          const spaceW = ctx.measureText(' ').width
          const ws = seg.words.map((wd) => ({ ...wd, width: ctx.measureText(wd.w).width }))
          const total = ws.reduce((a, b) => a + b.width, 0) + spaceW * (ws.length - 1)
          if (s2.bgOpacity > 0 || seg.hl) {
            ctx.fillStyle = seg.hl || `rgba(0,0,0,${s2.bgOpacity})`
            ctx.fillRect(anchor.x - total / 2 - px * 0.5, anchor.y - px, total + px, px * 2)
          }
          ctx.textAlign = 'left'
          let cx = anchor.x + total / 2
          for (const wd of ws) {
            const active = t >= wd.start && t <= wd.end
            const wpx = active ? Math.round(px * 1.15) : px
            ctx.font = `${active ? 800 : 700} ${wpx}px "${s2.fontId}"`
            const x = cx - wd.width
            if (s2.outline) { ctx.lineWidth = Math.max(2, wpx * 0.12); ctx.strokeStyle = '#000'; ctx.lineJoin = 'round'; ctx.strokeText(wd.w, x, anchor.y) }
            ctx.fillStyle = active ? s2.hlColor : s2.color
            ctx.fillText(wd.w, x, anchor.y)
            cx -= wd.width + spaceW
          }
        } else {
          ctx.font = `700 ${px}px "${s2.fontId}"`
          ctx.textAlign = 'center'
          const lines = wrapText(ctx, seg.text, W * 0.9)
          const lh = px * 1.5
          const totalH = lines.length * lh
          const y0 = s2.x != null ? anchor.y - totalH / 2 : anchor.y - totalH
          lines.forEach((ln, i) => {
            const y = y0 + i * lh + lh / 2
            if (s2.bgOpacity > 0 || seg.hl) {
              const w = ctx.measureText(ln).width + px
              ctx.fillStyle = seg.hl || `rgba(0,0,0,${s2.bgOpacity})`
              ctx.fillRect(anchor.x - w / 2, y - lh / 2, w, lh)
            }
            if (s2.outline) { ctx.lineWidth = Math.max(2, px * 0.12); ctx.strokeStyle = '#000'; ctx.lineJoin = 'round'; ctx.strokeText(ln, anchor.x, y) }
            ctx.fillStyle = s2.color
            ctx.fillText(ln, anchor.x, y)
          })
        }
      }
      let raf = 0
      const loop = () => {
        drawFrame()
        setExpProg(video.duration ? video.currentTime / video.duration : 0)
        if (!video.ended) raf = requestAnimationFrame(loop)
      }
      await video.play()
      raf = requestAnimationFrame(loop)
      await new Promise((res) => (video.onended = () => res(null)))
      cancelAnimationFrame(raf)
      rec.stop()
      await stopped
      ac.close()
      const blob = new Blob(parts, { type: mime || 'video/webm' })
      const ext = (mime || '').includes('mp4') ? 'mp4' : 'webm'
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = `${baseName}.subtitled.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    } catch (e: any) {
      alert('❌ خروجی ناموفق: ' + (e?.message || e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <button onClick={exportVideo} disabled={exporting || segments.length === 0}
        className="block w-full rounded bg-green-600 px-3 py-2 text-xs text-white hover:bg-green-700 disabled:opacity-50">
        {exporting ? `⏳ رندر ${Math.round(expProg * 100)}٪` : '🎥 خروجی ویدیو (رزولوشن اصلی)'}
      </button>
      {exporting && (
        <div className="h-2 w-full overflow-hidden rounded bg-gray-700 mt-2">
          <div className="h-full bg-green-600 transition-all" style={{ width: `${Math.round(expProg * 100)}%` }} />
        </div>
      )}
    </div>
  )
}
