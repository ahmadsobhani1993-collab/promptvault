'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { TranscriptSegment, getGeminiKey } from '@/lib/live-transcribe'
import { decodeToPcm16k } from '@/lib/audio'
import { prepareWavChunks } from '@/lib/audio-enhance'
import { toSrt, toVtt, toTxt, download } from '@/lib/subtitle'
import { useAuth } from '@/lib/use-auth'

const WORKER = 'https://gemini-live-proxy.ahmadsobhani1993.workers.dev'

const FONTS = [
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

type Fx = 'none' | 'pop' | 'zoomIn' | 'zoomOut'
type Seg = TranscriptSegment & { fx?: Fx; hl?: string }

const HL_COLORS = ['', '#e11d48', '#f59e0b', '#16a34a', '#2563eb', '#7c3aed']

const DEFAULT_STYLE = {
  fontId: 'Vazirmatn',
  size: 6,
  color: '#ffffff',
  bgOpacity: 0.55,
  outline: true,
  pos: 'bottom' as 'bottom' | 'top',
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
  try { await (document as any).fonts?.load(`700 40px "${id}"`) } catch {}
}

const easeOutBack = (x: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w } else line = test
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

export default function VideoSubtitleClient() {
  const auth = useAuth()

  const [videoUrl, setVideoUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [speed, setSpeed] = useState<1 | 2 | 4 | 8>(4)
  const [segments, setSegments] = useState<Seg[]>([])
  const [style, setStyle] = useState(DEFAULT_STYLE)
  const [customFonts, setCustomFonts] = useState<{ id: string; label: string }[]>([])
  const [time, setTime] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [expProg, setExpProg] = useState(0)
  const [failed, setFailed] = useState(false)

  const styleRef = useRef(style)
  styleRef.current = style
  const segRef = useRef(segments)
  segRef.current = segments
  const gotRef = useRef(0)
  const lastFileRef = useRef<File | null>(null)

  useEffect(() => { loadFont(style.fontId) }, [style.fontId])

  const baseName = fileName.replace(/\.[^.]+$/, '') || 'video'
  const current = segments.find((s) => time >= s.start && time <= s.end)

  // ─── فونت دلخواه کاربر ───
  const addCustomFont = async (f: File) => {
    try {
      const name = f.name.replace(/\.[^.]+$/, '')
      const url = URL.createObjectURL(f)
      const face = new FontFace(name, `url(${url})`)
      await face.load()
      ;(document as any).fonts.add(face)
      setCustomFonts((p) => [...p.filter((x) => x.id !== name), { id: name, label: `${name} (دلخواه)` }])
      setStyle((s) => ({ ...s, fontId: name }))
    } catch (e) {
      alert('❌ فونت نامعتبر — فایل ttf/otf/woff بده')
    }
  }

  // ─── ترنسکریپت REST (مسیر جدید) ───
  const runTranscribe = async (file: File) => {
    setSegments([])
    setProgress(0)
    setBusy(true)
    setFailed(false)
    gotRef.current = 0

    try {
      setStatus('۱. دیکود صدا (محلی)…')
      const pcm = await decodeToPcm16k(file)
      const parts = await prepareWavChunks(pcm, 30)
      if (parts.length === 0) {
        setStatus('❌ صدایی پیدا نشد')
        setBusy(false)
        return
      }

      setStatus('۲. ترنسکریپت (مدل اختصاصی)…')
      const key = await getGeminiKey()

      for (let i = 0; i < parts.length; i++) {
        const r = await fetch(`${WORKER}/transcribe?key=${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBase64: parts[i].data }),
        })
        if (!r.ok) throw new Error(`transcribe failed: ${r.status}`)
        const j = await r.json()
        const text: string = (j.text || '').trim()

        if (text) {
          // تقسیم به جملات برای زیرنویس تمیز + زمان‌بندی وزنی
          const sentences = text.match(/[^.!?؟\n]+[.!?؟]?/g) || [text]
          const words = sentences.map((s2) => s2.split(/\s+/).length)
          const totalW = words.reduce((a, b) => a + b, 0) || 1
          const dur = parts[i].end - parts[i].start
          let cursor = parts[i].start
          sentences.forEach((s2, k) => {
            const d = Math.max(0.5, (words[k] / totalW) * dur)
            const seg: Seg = { text: s2.trim(), start: cursor, end: cursor + d }
            cursor += d
            gotRef.current++
            setSegments((prev) => [...prev, seg])
          })
        }
        setProgress(Math.round(((i + 1) / parts.length) * 100))
      }

      if (gotRef.current === 0) {
        setFailed(true)
        setStatus('⚠️ متنی دریافت نشد — فایل دیگری امتحان کن')
      } else {
        setStatus('✅ آماده — ادیت کن و خروجی بگیر')
      }
    } catch (err: any) {
      setStatus('❌ ' + (err?.message || String(err)))
    } finally {
      setBusy(false)
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('video/')) { setStatus('❌ فقط فایل ویدیویی'); return }
    lastFileRef.current = file
    setFileName(file.name)
    setVideoUrl(URL.createObjectURL(file))
    await runTranscribe(file)
  }

  const updateSeg = (i: number, patch: Partial<Seg>) => setSegments(segments.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))

  // ─── خروجی ویدیو ───
  const exportVideo = async () => {
    if (exporting || !videoUrl) return
    setExporting(true)
    setExpProg(0)
    try {
      const video = document.createElement('video')
      video.src = videoUrl
      video.playsInline = true
      await new Promise((res, rej) => { video.onloadedmetadata = () => res(null); video.onerror = () => rej(new Error('load failed')) })

      const W = video.videoWidth
      const H = video.videoHeight
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')!

      const ac = new AudioContext()
      const srcNode = ac.createMediaElementSource(video)
      const dest = ac.createMediaStreamDestination()
      srcNode.connect(dest)

      const st0 = styleRef.current
      await loadFont(st0.fontId)
      try { await (document as any).fonts?.load(`700 40px "${st0.fontId}"`) } catch {}

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
        const sw = W / vs
        const sh = H / vs
        ctx.drawImage(video, (W - sw) / 2, (H - sh) / 2, sw, sh, 0, 0, W, H)

        if (seg) {
          const s2 = styleRef.current
          let ts = 1
          if (seg.fx === 'pop') ts = easeOutBack(Math.min(1, (t - seg.start) / 0.35))
          if (seg.fx === 'zoomIn') ts = 0.8 + 0.35 * t01
          if (seg.fx === 'zoomOut') ts = 1.15 - 0.35 * t01
          const px = Math.max(10, Math.round((s2.size / 100) * H * ts))

          ctx.font = `700 ${px}px "${s2.fontId}"`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const lines = wrapText(ctx, seg.text, W * 0.9)
          const lh = px * 1.5
          const y0 = s2.pos === 'bottom' ? H - H * 0.05 - lines.length * lh : H * 0.05

          lines.forEach((ln, i) => {
            const y = y0 + i * lh + lh / 2
            const bg = seg.hl || (s2.bgOpacity > 0 ? `rgba(0,0,0,${s2.bgOpacity})` : '')
            if (bg) {
              const w = ctx.measureText(ln).width + px
              ctx.fillStyle = bg
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
      alert('❌ خروجی ناموفق: ' + (e?.message || e))
    } finally {
      setExporting(false)
    }
  }

  const fxAnim = (seg: Seg) => {
    const dur = Math.max(0.3, seg.end - seg.start)
    if (seg.fx === 'pop') return 'subPop 0.35s ease-out both'
    if (seg.fx === 'zoomIn') return `subZoomIn ${dur}s linear both`
    if (seg.fx === 'zoomOut') return `subZoomOut ${dur}s linear both`
    return undefined
  }

  // ─── قفل ورود ───
  if (auth === 'checking') return <div className="p-10 text-center text-sm text-ink-muted">در حال بررسی…</div>
  if (auth === 'no')
    return (
      <div className="mx-auto max-w-md p-10 text-center" dir="rtl">
        <div className="card space-y-3 p-6">
          <div className="text-3xl">🔒</div>
          <strong>ورود لازم است</strong>
          <p className="text-xs text-ink-muted">برای استفاده از استودیو زیرنویس، ابتدا وارد حساب کاربری شو.</p>
          <Link href="/login" className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">ورود به حساب کاربری</Link>
        </div>
      </div>
    )

  return (
    <div className="container-app mx-auto max-w-5xl space-y-4 p-6" dir="rtl">
      <style>{`
        @keyframes subPop { 0% { transform: scale(0.5); opacity: 0 } 60% { transform: scale(1.1) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes subZoomIn { from { transform: scale(0.8) } to { transform: scale(1.2) } }
        @keyframes subZoomOut { from { transform: scale(1.2) } to { transform: scale(0.8) } }
      `}</style>

      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">🎬 استودیو زیرنویس ویدیو</h1>
        <Link href="/transcribe" className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs hover:bg-gray-600">🎙️ تبدیل صدا به متن</Link>
      </div>

      <p className="text-xs text-ink-muted">پردازش ۱۰۰٪ محلی — ویدیو هیچ‌جا آپلود نمی‌شود؛ خروجی روی دستگاه خودت دانلود می‌شود.</p>

      <div className="card space-y-3 p-4">
        <input type="file" accept="video/*" disabled={busy || exporting} onChange={handleFile} className="block w-full text-sm text-ink-muted file:ml-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-700 disabled:opacity-50" />
        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-muted">سرعت ترنسکریپت:</span>
          {([1, 2, 4, 8] as const).map((s) => (
            <button key={s} disabled={busy} onClick={() => setSpeed(s)} className={`rounded px-3 py-1 text-xs ${speed === s ? 'bg-blue-600 text-white' : 'bg-gray-700'}`}>{s}x</button>
          ))}
          {failed && lastFileRef.current && !busy && (
            <button onClick={() => { setSpeed(1); runTranscribe(lastFileRef.current!) }} className="rounded bg-yellow-600 px-3 py-1 text-xs text-white">🔁 تلاش مجدد با 1x</button>
          )}
        </div>
        {busy && (
          <div className="h-2 w-full overflow-hidden rounded bg-gray-700">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {status && (
        <div className={`rounded-lg p-3 text-sm ${status.startsWith('✅') ? 'bg-green-500/10 text-green-400' : status.startsWith('❌') ? 'bg-red-500/10 text-red-400' : status.startsWith('⚠️') ? 'bg-yellow-500/10 text-yellow-400' : 'bg-blue-500/10 text-blue-400'}`}>{status}</div>
      )}

      {videoUrl && (
        <div className="card space-y-4 p-4">
          <div className="relative w-full overflow-hidden rounded-xl bg-black aspect-video" style={{ containerType: 'inline-size' }}>
            <video src={videoUrl} controls playsInline onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} className="h-full w-full object-contain" />
            {current && (
              <div className="pointer-events-none absolute inset-x-0 flex justify-center px-3" style={style.pos === 'bottom' ? { bottom: '5%' } : { top: '5%' }}>
                <span
                  key={current.start + current.text}
                  dir="auto"
                  className="text-center"
                  style={{
                    fontFamily: `"${style.fontId}"`,
                    fontWeight: 700,
                    fontSize: `clamp(12px, ${style.size}cqi, 60px)`,
                    color: style.color,
                    backgroundColor: current.hl || (style.bgOpacity > 0 ? `rgba(0,0,0,${style.bgOpacity})` : 'transparent'),
                    padding: '0.2em 0.6em',
                    borderRadius: '0.5em',
                    textShadow: style.outline ? '0 2px 6px rgba(0,0,0,0.9)' : 'none',
                    animation: fxAnim(current),
                  }}
                >
                  {current.text}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-7">
            <div>
              <div className="mb-1 text-ink-muted">فونت</div>
              <select value={style.fontId} onChange={(e) => setStyle({ ...style, fontId: e.target.value })} className="w-full rounded bg-gray-700 p-1.5">
                {customFonts.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <label className="cursor-pointer rounded bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-700">
                ＋ فونت دلخواه
                <input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={(e) => e.target.files?.[0] && addCustomFont(e.target.files[0])} />
              </label>
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
              <div className="mb-1 text-ink-muted">حاشیه</div>
              <button onClick={() => setStyle({ ...style, outline: !style.outline })} className={`rounded px-3 py-1 ${style.outline ? 'bg-blue-600 text-white' : 'bg-gray-700'}`}>{style.outline ? 'روشن' : 'خاموش'}</button>
            </div>
            <div>
              <div className="mb-1 text-ink-muted">مکان</div>
              <button onClick={() => setStyle({ ...style, pos: style.pos === 'bottom' ? 'top' : 'bottom' })} className="rounded bg-gray-700 px-3 py-1">{style.pos === 'bottom' ? 'پایین' : 'بالا'}</button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-gray-700 pt-3">
            <button onClick={() => download(`${baseName}.srt`, toSrt(segments), 'text/plain')} className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white">⬇ SRT</button>
            <button onClick={() => download(`${baseName}.vtt`, toVtt(segments), 'text/vtt')} className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white">⬇ VTT</button>
            <button onClick={() => download(`${baseName}.txt`, toTxt(segments))} className="rounded bg-gray-700 px-3 py-1.5 text-xs">⬇ TXT</button>
            <button onClick={exportVideo} disabled={exporting || segments.length === 0} className="rounded bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700 disabled:opacity-50">
              {exporting ? `⏳ رندر ${Math.round(expProg * 100)}٪` : '🎥 خروجی ویدیو با زیرنویس'}
            </button>
          </div>
          {exporting && (
            <div className="h-2 w-full overflow-hidden rounded bg-gray-700">
              <div className="h-full bg-green-600 transition-all" style={{ width: `${Math.round(expProg * 100)}%` }} />
            </div>
          )}

          <div className="max-h-[28rem] space-y-2 overflow-y-auto">
            {segments.map((s, i) => (
              <div key={i} className="rounded-lg bg-gray-800/50 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input type="number" step={0.1} min={0} value={Number(s.start.toFixed(1))} onChange={(e) => updateSeg(i, { start: Number(e.target.value) })} className="w-20 rounded bg-gray-700 p-1 font-mono text-[11px]" />
                  <span className="text-[11px] text-ink-muted">تا</span>
                  <input type="number" step={0.1} min={0} value={Number(s.end.toFixed(1))} onChange={(e) => updateSeg(i, { end: Number(e.target.value) })} className="w-20 rounded bg-gray-700 p-1 font-mono text-[11px]" />
                  <select value={s.fx || 'none'} onChange={(e) => updateSeg(i, { fx: e.target.value as Fx })} className="rounded bg-gray-700 p-1 text-[11px]">
                    <option value="none">بدون افکت</option>
                    <option value="pop">پاپ</option>
                    <option value="zoomIn">زوم این</option>
                    <option value="zoomOut">زوم اوت</option>
                  </select>
                  <div className="flex items-center gap-1">
                    {HL_COLORS.map((c) => (
                      <button key={c || 'none'} onClick={() => updateSeg(i, { hl: c || undefined })} className={`h-5 w-5 rounded border-2 ${(s.hl || '') === c ? 'border-white' : 'border-gray-600'}`} style={{ backgroundColor: c || 'transparent' }} />
                    ))}
                  </div>
                  <button onClick={() => setSegments(segments.filter((_, idx) => idx !== i))} className="mr-auto text-red-400">✕</button>
                </div>
                <textarea value={s.text} rows={1} onChange={(e) => updateSeg(i, { text: e.target.value })} className="mt-1 w-full resize-y bg-transparent text-sm outline-none" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
