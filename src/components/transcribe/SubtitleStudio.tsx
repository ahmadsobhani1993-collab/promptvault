'use client'

import { useEffect, useRef, useState } from 'react'
import type { TranscriptSegment } from '@/lib/live-transcribe'
import { toSrt, toVtt, toTxt, download } from '@/lib/subtitle'

export const FONTS = [
  { id: 'Vazirmatn', label: 'وزیرمتن' },
  { id: 'Lalezar', label: 'لاله‌زار' },
  { id: 'Markazi Text', label: 'مرکزی' },
  { id: 'Noto Nastaliq Urdu', label: 'نستعلیق' },
  { id: 'Noto Naskh Arabic', label: 'نسخ' },
  { id: 'Noto Kufi Arabic', label: 'کوفی' },
  { id: 'Cairo', label: 'قاهره' },
  { id: 'Tajawal', label: 'تجوال' },
  { id: 'Almarai', label: 'مرعی' },
  { id: 'Readex Pro', label: 'ریدکس' },
  { id: 'IBM Plex Sans Arabic', label: 'پلکس' },
  { id: 'Amiri', label: 'امیری' },
  { id: 'Reem Kufi', label: 'ریم کوفی' },
  { id: 'Aref Ruqaa', label: 'رقعه' },
  { id: 'Gulzar', label: 'گلزار' },
  { id: 'Jomhuria', label: 'جمهوری' },
]

export interface SubStyle {
  fontId: string
  size: number // % ارتفاع ویدیو
  color: string
  bgOpacity: number // 0..1
  outline: boolean
  pos: 'bottom' | 'top'
}

const DEFAULT_STYLE: SubStyle = {
  fontId: 'Vazirmatn',
  size: 6,
  color: '#ffffff',
  bgOpacity: 0.55,
  outline: true,
  pos: 'bottom',
}

async function loadFont(id: string) {
  const lid = 'gf-' + id.replace(/\s+/g, '-')
  if (!document.getElementById(lid)) {
    const l = document.createElement('link')
    l.id = lid
    l.rel = 'stylesheet'
    l.href = `https://fonts.googleapis.com/css2?family=${id.replace(/ /g, '+')}:wght@400;700&display=swap`
    document.head.appendChild(l)
  }
  try {
    await (document as any).fonts?.load(`700 40px "${id}"`)
  } catch {}
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

type Props = {
  videoUrl: string
  baseName: string
  segments: TranscriptSegment[]
  onChange: (segs: TranscriptSegment[]) => void
}

export default function SubtitleStudio({ videoUrl, baseName, segments, onChange }: Props) {
  const [time, setTime] = useState(0)
  const [style, setStyle] = useState<SubStyle>(DEFAULT_STYLE)
  const [exporting, setExporting] = useState(false)
  const [expProg, setExpProg] = useState(0)

  const styleRef = useRef(style)
  styleRef.current = style
  const segRef = useRef(segments)
  segRef.current = segments

  useEffect(() => {
    loadFont(style.fontId)
  }, [style.fontId])

  const current = segments.find((s) => time >= s.start && time <= s.end)

  const updateSeg = (i: number, patch: Partial<TranscriptSegment>) =>
    onChange(segments.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))

  const removeSeg = (i: number) => onChange(segments.filter((_, idx) => idx !== i))

  // ─── خروجی ویدیو با زیرنویس (کیفیت اصلی، کاملاً client-side) ───
  const exportVideo = async () => {
    if (exporting) return
    setExporting(true)
    setExpProg(0)
    try {
      const video = document.createElement('video')
      video.src = videoUrl
      video.playsInline = true
      await new Promise((res, rej) => {
        video.onloadedmetadata = () => res(null)
        video.onerror = () => rej(new Error('video load failed'))
      })

      const W = video.videoWidth
      const H = video.videoHeight
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')!

      // صدا بدون پخش شنیداری
      const ac = new AudioContext()
      const srcNode = ac.createMediaElementSource(video)
      const dest = ac.createMediaStreamDestination()
      srcNode.connect(dest)

      const st = styleRef.current
      await loadFont(st.fontId)

      const stream = canvas.captureStream(30)
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))

      const mime = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) || ''
      const rec = new MediaRecorder(stream, {
        mimeType: mime || undefined,
        videoBitsPerSecond: Math.max(8_000_000, W * H * 10),
      })
      const parts: Blob[] = []
      rec.ondataavailable = (e) => e.data.size && parts.push(e.data)
      const stopped = new Promise((res) => (rec.onstop = () => res(null)))
      rec.start(1000)

      const drawFrame = () => {
        ctx.drawImage(video, 0, 0, W, H)
        const seg = segRef.current.find((s) => video.currentTime >= s.start && video.currentTime <= s.end)
        if (seg) {
          const s2 = styleRef.current
          const px = Math.round((s2.size / 100) * H)
          ctx.font = `700 ${px}px "${s2.fontId}"`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const lines = wrapText(ctx, seg.text, W * 0.9)
          const lh = px * 1.5
          const totalH = lines.length * lh
          const y0 = s2.pos === 'bottom' ? H - H * 0.05 - totalH : H * 0.05
          lines.forEach((ln, i) => {
            const y = y0 + i * lh + lh / 2
            if (s2.bgOpacity > 0) {
              const w = ctx.measureText(ln).width + px
              ctx.fillStyle = `rgba(0,0,0,${s2.bgOpacity})`
              ctx.fillRect(W / 2 - w / 2, y - lh / 2, w, lh)
            }
            if (s2.outline) {
              ctx.lineWidth = Math.max(2, px * 0.12)
              ctx.strokeStyle = '#000'
              ctx.lineJoin = 'round'
              ctx.strokeText(ln, W / 2, y)
            }
            ctx.fillStyle = s2.color
            ctx.fillText(ln, W / 2, y)
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
      a.href = URL.createObjectURL(blob)
      a.download = `${baseName}.subtitled.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    } catch (e: any) {
      console.error('[export]', e)
      alert('❌ خروجی ویدیو ناموفق: ' + (e?.message || e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="card space-y-4 p-4">
      <strong className="text-sm">🎬 استودیو زیرنویس</strong>

      {/* پیش‌نمایش 16:9 */}
      <div className="relative w-full overflow-hidden rounded-xl bg-black aspect-video">
        <video
          src={videoUrl}
          controls
          playsInline
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          className="h-full w-full object-contain"
        />
        {current && (
          <div
            className="pointer-events-none absolute inset-x-0 flex justify-center px-3"
            style={style.pos === 'bottom' ? { bottom: '5%' } : { top: '5%' }}
          >
            <span
              dir="auto"
              className="text-center"
              style={{
                fontFamily: `"${style.fontId}"`,
                fontWeight: 700,
                fontSize: `clamp(12px, ${style.size}cqi, 60px)`,
                color: style.color,
                backgroundColor: style.bgOpacity > 0 ? `rgba(0,0,0,${style.bgOpacity})` : 'transparent',
                padding: style.bgOpacity > 0 ? '0.2em 0.6em' : 0,
                borderRadius: '0.5em',
                textShadow: style.outline ? '0 2px 6px rgba(0,0,0,0.9)' : 'none',
              }}
            >
              {current.text}
            </span>
          </div>
        )}
      </div>

      {/* کنترل استایل */}
      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <div className="mb-1 text-ink-muted">فونت</div>
          <select
            value={style.fontId}
            onChange={(e) => setStyle({ ...style, fontId: e.target.value })}
            className="w-full rounded bg-gray-700 p-1.5"
          >
            {FONTS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="mb-1 text-ink-muted">اندازه: {style.size}٪</div>
          <input type="range" min={3} max={12} value={style.size} onChange={(e) => setStyle({ ...style, size: Number(e.target.value) })} className="w-full" />
        </div>
        <div>
          <div className="mb-1 text-ink-muted">رنگ متن</div>
          <div className="flex items-center gap-1">
            {['#ffffff', '#ffe14d', '#7CFC00', '#ff5555'].map((c) => (
              <button key={c} onClick={() => setStyle({ ...style, color: c })} className={`h-6 w-6 rounded border-2 ${style.color === c ? 'border-blue-500' : 'border-gray-600'}`} style={{ backgroundColor: c }} />
            ))}
            <input type="color" value={style.color} onChange={(e) => setStyle({ ...style, color: e.target.value })} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
          </div>
        </div>
        <div>
          <div className="mb-1 text-ink-muted">پس‌زمینه: {Math.round(style.bgOpacity * 100)}٪</div>
          <input type="range" min={0} max={100} value={Math.round(style.bgOpacity * 100)} onChange={(e) => setStyle({ ...style, bgOpacity: Number(e.target.value) / 100 })} className="w-full" />
        </div>
        <div>
          <div className="mb-1 text-ink-muted">حاشیه (outline)</div>
          <button onClick={() => setStyle({ ...style, outline: !style.outline })} className={`rounded px-3 py-1 ${style.outline ? 'bg-blue-600 text-white' : 'bg-gray-700'}`}>
            {style.outline ? 'روشن' : 'خاموش'}
          </button>
        </div>
        <div>
          <div className="mb-1 text-ink-muted">مکان</div>
          <button onClick={() => setStyle({ ...style, pos: style.pos === 'bottom' ? 'top' : 'bottom' })} className="rounded bg-gray-700 px-3 py-1 hover:bg-gray-600">
            {style.pos === 'bottom' ? 'پایین' : 'بالا'}
          </button>
        </div>
      </div>

      {/* خروجی‌ها */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-700 pt-3">
        <button onClick={() => download(`${baseName}.srt`, toSrt(segments), 'text/plain')} className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700">⬇ SRT</button>
        <button onClick={() => download(`${baseName}.vtt`, toVtt(segments), 'text/vtt')} className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700">⬇ VTT</button>
        <button onClick={() => download(`${baseName}.txt`, toTxt(segments))} className="rounded bg-gray-700 px-3 py-1.5 text-xs hover:bg-gray-600">⬇ TXT</button>
        <button
          onClick={exportVideo}
          disabled={exporting}
          className="rounded bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700 disabled:opacity-50"
        >
          {exporting ? `⏳ رندر ${Math.round(expProg * 100)}٪` : '🎥 خروجی ویدیو با زیرنویس'}
        </button>
        <span className="text-[11px] text-ink-muted">رندر هم‌زمان = کیفیت اصلی، بدون سرور</span>
      </div>

      {exporting && (
        <div className="h-2 w-full overflow-hidden rounded bg-gray-700">
          <div className="h-full bg-green-600 transition-all" style={{ width: `${Math.round(expProg * 100)}%` }} />
        </div>
      )}

      {/* ادیتور سگمنت‌ها با زمان قابل ویرایش */}
      <div className="max-h-[28rem] space-y-2 overflow-y-auto">
        {segments.map((s, i) => (
          <div key={i} className="rounded-lg bg-gray-800/50 p-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                step={0.1}
                min={0}
                value={Number(s.start.toFixed(1))}
                onChange={(e) => updateSeg(i, { start: Number(e.target.value) })}
                className="w-20 rounded bg-gray-700 p-1 font-mono text-[11px]"
              />
              <span className="text-[11px] text-ink-muted">تا</span>
              <input
                type="number"
                step={0.1}
                min={0}
                value={Number(s.end.toFixed(1))}
                onChange={(e) => updateSeg(i, { end: Number(e.target.value) })}
                className="w-20 rounded bg-gray-700 p-1 font-mono text-[11px]"
              />
              <span className="text-[11px] text-ink-muted">ثانیه</span>
              <button onClick={() => removeSeg(i)} className="mr-auto text-red-400 hover:text-red-300" title="حذف">✕</button>
            </div>
            <textarea
              value={s.text}
              onChange={(e) => updateSeg(i, { text: e.target.value })}
              rows={1}
              className="mt-1 w-full resize-y bg-transparent text-sm outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
