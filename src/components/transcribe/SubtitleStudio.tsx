'use client'

import { useEffect, useRef, useState } from 'react'
import {
  FONTS, PRESETS, HL_COLORS, DEFAULT_STYLE,
  type Seg, type Style, type Fx, mkWords, loadFont,
} from '@/lib/subtitle-studio'

type Props = {
  videoUrl: string
  segments: Seg[]
  setSegments: (s: Seg[]) => void
}

export default function SubtitleStudio({ videoUrl, segments, setSegments }: Props) {
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE)
  const [customFonts, setCustomFonts] = useState<{ id: string; label: string }[]>([])
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [vidW, setVidW] = useState(0)
  const [vidH, setVidH] = useState(0)
  const [selected, setSelected] = useState(-1)
  const [zoom, setZoom] = useState(40)
  const [showSafe, setShowSafe] = useState(false)
  const [showAdv, setShowAdv] = useState(false)
  const [findQ, setFindQ] = useState('')
  const [replQ, setReplQ] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const histRef = useRef<string[]>([])
  const futRef = useRef<string[]>([])

  useEffect(() => { loadFont(style.fontId) }, [style.fontId])
  const current = segments.find((s) => time >= s.start && time <= s.end)

  const snapshot = () => {
    histRef.current.push(JSON.stringify({ segments, style }))
    if (histRef.current.length > 60) histRef.current.shift()
    futRef.current = []
  }
  const undo = () => {
    const h = histRef.current.pop()
    if (!h) return
    futRef.current.push(JSON.stringify({ segments, style }))
    const s = JSON.parse(h)
    setSegments(s.segments); setStyle(s.style)
  }
  const redo = () => {
    const h = futRef.current.pop()
    if (!h) return
    histRef.current.push(JSON.stringify({ segments, style }))
    const s = JSON.parse(h)
    setSegments(s.segments); setStyle(s.style)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const v = videoRef.current
      if (!v) return
      if (e.code === 'Space') { e.preventDefault(); v.paused ? v.play() : v.pause() }
      if (e.code === 'ArrowRight') v.currentTime = Math.min(v.duration, v.currentTime + 1)
      if (e.code === 'ArrowLeft') v.currentTime = Math.max(0, v.currentTime - 1)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const seek = (t: number) => { if (videoRef.current) videoRef.current.currentTime = t }

  const onSubPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const move = (ev: PointerEvent) => {
      const x = Math.min(95, Math.max(5, ((ev.clientX - rect.left) / rect.width) * 100))
      const y = Math.min(95, Math.max(5, ((ev.clientY - rect.top) / rect.height) * 100))
      setStyle((s) => ({ ...s, x, y }))
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const addCustomFont = async (f: File) => {
    try {
      const name = f.name.replace(/\.[^.]+$/, '')
      const url = URL.createObjectURL(f)
      const face = new FontFace(name, `url(${url})`)
      await face.load()
      ;(document as any).fonts.add(face)
      setCustomFonts((p) => [...p.filter((x) => x.id !== name), { id: name, label: `${name} (دلخواه)` }])
      setStyle((s) => ({ ...s, fontId: name }))
    } catch { alert('❌ فونت نامعتبر') }
  }

  const updateSeg = (i: number, patch: Partial<Seg>, hist = true) => {
    if (hist) snapshot()
    setSegments(segments.map((s, idx) => {
      if (idx !== i) return s
      const next = { ...s, ...patch }
      if (patch.text !== undefined) next.words = mkWords(next.text, next.start, next.end)
      return next
    }))
  }
  const splitSeg = (i: number) => {
    const s = segments[i]
    const toks = s.text.split(/\s+/)
    if (toks.length < 2) return
    snapshot()
    const half = Math.ceil(toks.length / 2)
    const mid = s.start + (s.end - s.start) * (half / toks.length)
    const a: Seg = { ...s, text: toks.slice(0, half).join(' '), start: s.start, end: mid, words: [] }
    const b: Seg = { ...s, text: toks.slice(half).join(' '), start: mid, end: s.end, words: [] }
    a.words = mkWords(a.text, a.start, a.end); b.words = mkWords(b.text, b.start, b.end)
    setSegments([...segments.slice(0, i), a, b, ...segments.slice(i + 1)])
  }
  const mergeSeg = (i: number) => {
    if (i >= segments.length - 1) return
    snapshot()
    const a = segments[i], b = segments[i + 1]
    const m: Seg = { ...a, text: a.text + ' ' + b.text, end: b.end, words: [] }
    m.words = mkWords(m.text, m.start, m.end)
    setSegments([...segments.slice(0, i), m, ...segments.slice(i + 2)])
  }
  const findReplace = () => {
    if (!findQ) return
    snapshot()
    setSegments(segments.map((s) => {
      const t = s.text.split(findQ).join(replQ)
      return { ...s, text: t, words: mkWords(t, s.start, s.end) }
    }))
  }
  const applyPreset = (p: (typeof PRESETS)[number]) => {
    snapshot()
    setStyle((s) => ({ ...s, fontId: p.fontId, size: p.size, color: p.color, bgOpacity: p.bgOpacity, outline: p.outline, karaoke: p.karaoke, hlColor: p.hlColor }))
  }
  const cps = (s: Seg) => s.text.length / Math.max(0.5, s.end - s.start)

  const fxAnim = (seg: Seg) => {
    const dur = Math.max(0.3, seg.end - seg.start)
    if (seg.fx === 'pop') return 'subPop 0.35s ease-out both'
    if (seg.fx === 'zoomIn') return `subZoomIn ${dur}s linear both`
    if (seg.fx === 'zoomOut') return `subZoomOut ${dur}s linear both`
    if (seg.fx === 'slide') return 'subSlide 0.4s ease-out both'
    return undefined
  }

  return (
    <>
      <style>{`
        @keyframes subPop { 0% { transform: scale(0.5); opacity: 0 } 60% { transform: scale(1.1) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes subZoomIn { from { transform: scale(0.8) } to { transform: scale(1.2) } }
        @keyframes subZoomOut { from { transform: scale(1.2) } to { transform: scale(0.8) } }
        @keyframes subSlide { from { transform: translateX(-40px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
      `}</style>

      {/* نوار ابزار بالا */}
      <div className="flex items-center gap-2 text-xs">
        <button onClick={undo} className="rounded bg-gray-700 px-2 py-1 hover:bg-gray-600">↩ Undo</button>
        <button onClick={redo} className="rounded bg-gray-700 px-2 py-1 hover:bg-gray-600">↪ Redo</button>
        <button onClick={() => setShowSafe(!showSafe)} className={`rounded px-2 py-1 ${showSafe ? 'bg-blue-600 text-white' : 'bg-gray-700'}`}>Safe Zone</button>
        {vidW > 0 && <span className="rounded bg-gray-800 px-2 py-1 text-ink-muted">خروجی: {vidW}×{vidH} (اصلی)</span>}
      </div>

      {/* پیش‌نمایش */}
      <div ref={stageRef} className="relative w-full overflow-hidden rounded-xl bg-black aspect-video select-none" style={{ containerType: 'inline-size' }}>
        <video
          ref={videoRef} src={videoUrl} controls playsInline
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); setVidW(e.currentTarget.videoWidth); setVidH(e.currentTarget.videoHeight) }}
          className="h-full w-full object-contain"
        />
        {showSafe && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[12%] bg-red-500/20 border-b border-red-500/50" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] bg-red-500/20 border-t border-red-500/50" />
          </>
        )}
        {current && (
          <div
            onPointerDown={onSubPointerDown}
            className="absolute cursor-move px-2"
            style={style.x != null
              ? { left: `${style.x}%`, top: `${style.y}%`, transform: 'translate(-50%,-50%)', maxWidth: '90%' }
              : { insetX: 0, bottom: '6%', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}
          >
            <span
              key={current.start + current.text} dir="rtl" className="text-center"
              style={{
                fontFamily: `"${style.fontId}"`, fontWeight: 700,
                fontSize: `clamp(12px, ${style.size}cqi, 60px)`,
                color: style.color,
                backgroundColor: current.hl || (style.bgOpacity > 0 ? `rgba(0,0,0,${style.bgOpacity})` : 'transparent'),
                padding: '0.2em 0.6em', borderRadius: '0.5em',
                textShadow: style.outline ? '0 2px 6px rgba(0,0,0,0.9)' : 'none',
                animation: fxAnim(current),
              }}
            >
              {style.karaoke && current.words?.length ? (
                current.words.map((wd, i) => {
                  const active = time >= wd.start && time <= wd.end
                  return (
                    <span key={i} style={{ display: 'inline-block', color: active ? style.hlColor : style.color, transform: active ? 'scale(1.15)' : undefined, fontWeight: active ? 800 : 700, transition: 'transform .12s, color .12s' }}>
                      {wd.w}{' '}
                    </span>
                  )
                })
              ) : current.text}
            </span>
          </div>
        )}
      </div>

      {/* Presets + font */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => applyPreset(p)} className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs hover:bg-gray-700">{p.label}</button>
        ))}
        <label className="cursor-pointer rounded-lg bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-700">
          ＋ فونت دلخواه
          <input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={(e) => e.target.files?.[0] && addCustomFont(e.target.files[0])} />
        </label>
        <button onClick={() => setShowAdv(!showAdv)} className={`rounded-lg px-3 py-1.5 text-xs ${showAdv ? 'bg-blue-600 text-white' : 'bg-gray-800'}`}>⚙ تنظیمات</button>
      </div>

      {showAdv && (
        <div className="card grid grid-cols-2 gap-3 p-3 text-xs sm:grid-cols-4 lg:grid-cols-7">
          <div>
            <div className="mb-1 text-ink-muted">فونت</div>
            <select value={style.fontId} onChange={(e) => setStyle({ ...style, fontId: e.target.value })} className="w-full rounded bg-gray-700 p-1.5">
              {customFonts.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1 text-ink-muted">اندازه: {style.size}٪</div>
            <input type="range" min={3} max={12} value={style.size} onChange={(e) => setStyle({ ...style, size: Number(e.target.value) })} className="w-full" />
          </div>
          <div>
            <div className="mb-1 text-ink-muted">رنگ متن</div>
            <input type="color" value={style.color} onChange={(e) => setStyle({ ...style, color: e.target.value })} className="h-7 w-full cursor-pointer rounded border-0 bg-transparent p-0" />
          </div>
          <div>
            <div className="mb-1 text-ink-muted">رنگ کاراوکه</div>
            <input type="color" value={style.hlColor} onChange={(e) => setStyle({ ...style, hlColor: e.target.value })} className="h-7 w-full cursor-pointer rounded border-0 bg-transparent p-0" />
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
            <button onClick={() => setStyle({ ...style, x: null, y: null })} className="rounded bg-gray-700 px-3 py-1">بازگشت به پایین</button>
          </div>
        </div>
      )}

      {/* تایم‌لاین */}
      {duration > 0 && (
        <div className="card space-y-2 p-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink-muted">تایم‌لاین</span>
            <input type="range" min={10} max={120} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-32" />
            <span className="font-mono text-ink-muted">{time.toFixed(1)}s / {duration.toFixed(1)}s</span>
          </div>
          <div className="overflow-x-auto rounded-lg bg-gray-900 p-2">
            <div
              className="relative h-16"
              style={{ width: Math.max(300, duration * zoom) }}
              onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                seek(Math.max(0, Math.min(duration, (e.clientX - rect.left) / zoom)))
              }}
            >
              {segments.map((s, i) => (
                <div key={i} onPointerDown={(e) => { e.stopPropagation(); setSelected(i); seek(s.start) }}
                  className={`absolute top-2 h-8 cursor-pointer rounded border text-center text-[10px] leading-8 ${i === selected ? 'border-blue-400 bg-blue-600/60' : 'border-gray-600 bg-gray-700/70'} ${cps(s) > 22 ? '!border-yellow-500' : ''}`}
                  style={{ left: s.start * zoom, width: Math.max(14, (s.end - s.start) * zoom) }} title={s.text}>
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      const startX = e.clientX, origStart = s.start
                      const move = (ev: PointerEvent) => updateSeg(i, { start: Math.max(0, origStart + (ev.clientX - startX) / zoom) }, false)
                      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
                      snapshot()
                      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
                    }}
                    className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/30" />
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      const startX = e.clientX, origEnd = s.end
                      const move = (ev: PointerEvent) => updateSeg(i, { end: Math.max(s.start + 0.3, origEnd + (ev.clientX - startX) / zoom) }, false)
                      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
                      snapshot()
                      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
                    }}
                    className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/30" />
                </div>
              ))}
              <div className="pointer-events-none absolute top-0 h-full w-0.5 bg-red-500" style={{ left: time * zoom }} />
            </div>
          </div>
        </div>
      )}

      {/* Transcript */}
      <div className="card space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <strong>Transcript ({segments.length})</strong>
          <input placeholder="جستجو" value={findQ} onChange={(e) => setFindQ(e.target.value)} className="rounded bg-gray-700 px-2 py-1" />
          <input placeholder="جایگزینی" value={replQ} onChange={(e) => setReplQ(e.target.value)} className="rounded bg-gray-700 px-2 py-1" />
          <button onClick={findReplace} className="rounded bg-blue-600 px-2 py-1 text-white">اعمال</button>
        </div>
        <div className="max-h-[24rem] space-y-2 overflow-y-auto">
          {segments.map((s, i) => (
            <div key={i} onClick={() => { setSelected(i); seek(s.start) }}
              className={`cursor-pointer rounded-lg p-2 ${time >= s.start && time <= s.end ? 'bg-blue-600/20 ring-1 ring-blue-500' : 'bg-gray-800/50 hover:bg-gray-800'}`}>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-mono text-ink-muted">{s.start.toFixed(1)}–{s.end.toFixed(1)}</span>
                {cps(s) > 22 && <span className="text-yellow-400" title="سرعت خواندن زیاد">⚠️ تند</span>}
                <select value={s.fx || 'none'} onChange={(e) => updateSeg(i, { fx: e.target.value as Fx })} className="rounded bg-gray-700 p-0.5">
                  <option value="none">بدون افکت</option>
                  <option value="pop">پاپ</option>
                  <option value="zoomIn">زوم این</option>
                  <option value="zoomOut">زوم اوت</option>
                  <option value="slide">اسلاید</option>
                </select>
                <div className="flex items-center gap-1">
                  {HL_COLORS.map((c) => (
                    <button key={c || 'none'} onClick={() => updateSeg(i, { hl: c || undefined })}
                      className={`h-4 w-4 rounded border ${(s.hl || '') === c ? 'border-white' : 'border-gray-600'}`}
                      style={{ backgroundColor: c || 'transparent' }} />
                  ))}
                </div>
                <button onClick={(e) => { e.stopPropagation(); splitSeg(i) }} className="rounded bg-gray-700 px-1.5">✂️</button>
                <button onClick={(e) => { e.stopPropagation(); mergeSeg(i) }} className="rounded bg-gray-700 px-1.5">🔗</button>
                <button onClick={(e) => { e.stopPropagation(); snapshot(); setSegments(segments.filter((_, idx) => idx !== i)) }} className="mr-auto text-red-400">✕</button>
              </div>
              <textarea value={s.text} rows={1} onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateSeg(i, { text: e.target.value })}
                className="mt-1 w-full resize-y bg-transparent text-sm outline-none" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
