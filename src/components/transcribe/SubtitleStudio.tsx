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

const fmt = (t: number) => {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
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

  const iconBtn = 'rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-white/60 transition hover:border-amber-500/40 hover:text-amber-300'

  return (
    <>
      <style>{`
        @keyframes subPop { 0% { transform: scale(0.5); opacity: 0 } 60% { transform: scale(1.1) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes subZoomIn { from { transform: scale(0.8) } to { transform: scale(1.2) } }
        @keyframes subZoomOut { from { transform: scale(1.2) } to { transform: scale(0.8) } }
        @keyframes subSlide { from { transform: translateX(-40px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
      `}</style>

      {/* ─── Toolbar ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button onClick={undo} title="واگرد (Ctrl+Z)" className={iconBtn}>↩</button>
          <button onClick={redo} title="ازنو (Ctrl+Shift+Z)" className={iconBtn}>↪</button>
          <button onClick={() => setShowSafe(!showSafe)} title="ناحیه امن اینستاگرام" className={`${iconBtn} ${showSafe ? '!border-amber-500/60 !text-amber-300' : ''}`}>▦</button>
          <button onClick={() => setShowAdv(!showAdv)} title="تنظیمات استایل" className={`${iconBtn} ${showAdv ? '!border-amber-500/60 !text-amber-300' : ''}`}>⚙</button>
        </div>
        {vidW > 0 && (
          <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] text-white/40">
            خروجی: {vidW}×{vidH} — رزولوشن اصلی
          </span>
        )}
      </div>

      {/* ─── Workspace ── */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Preview */}
        <div className="space-y-3 lg:col-span-3">
          <div ref={stageRef} className="relative w-full select-none overflow-hidden rounded-2xl border border-white/10 bg-black aspect-video" style={{ containerType: 'inline-size' }}>
            <video
              ref={videoRef} src={videoUrl} controls playsInline
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); setVidW(e.currentTarget.videoWidth); setVidH(e.currentTarget.videoHeight) }}
              className="h-full w-full object-contain"
            />
            {showSafe && (
              <>
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[12%] border-b border-amber-500/30 bg-amber-500/10" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] border-t border-amber-500/30 bg-amber-500/10" />
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
          <p className="text-[10px] text-white/30">💡 کپشن را با موس بگیر و جابه‌جا کن</p>

          {/* Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.id} onClick={() => applyPreset(p)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/70 transition hover:border-amber-500/40 hover:text-amber-300">
                {p.label}
              </button>
            ))}
            <label className="cursor-pointer rounded-lg border border-dashed border-white/20 px-3 py-1.5 text-[11px] text-white/50 transition hover:border-amber-500/50 hover:text-amber-300">
              ＋ فونت دلخواه
              <input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={(e) => e.target.files?.[0] && addCustomFont(e.target.files[0])} />
            </label>
          </div>

          {showAdv && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-zinc-900/60 p-3 text-xs sm:grid-cols-4 lg:grid-cols-7">
              <div>
                <div className="mb-1 text-white/40">فونت</div>
                <select value={style.fontId} onChange={(e) => setStyle({ ...style, fontId: e.target.value })} className="w-full rounded-lg border border-white/10 bg-black/40 p-1.5 text-white/80">
                  {customFonts.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <div className="mb-1 text-white/40">اندازه: {style.size}٪</div>
                <input type="range" min={3} max={12} value={style.size} onChange={(e) => setStyle({ ...style, size: Number(e.target.value) })} className="w-full accent-amber-500" />
              </div>
              <div>
                <div className="mb-1 text-white/40">رنگ متن</div>
                <input type="color" value={style.color} onChange={(e) => setStyle({ ...style, color: e.target.value })} className="h-7 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent p-0" />
              </div>
              <div>
                <div className="mb-1 text-white/40">رنگ کاراوکه</div>
                <input type="color" value={style.hlColor} onChange={(e) => setStyle({ ...style, hlColor: e.target.value })} className="h-7 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent p-0" />
              </div>
              <div>
                <div className="mb-1 text-white/40">پس‌زمینه: {Math.round(style.bgOpacity * 100)}٪</div>
                <input type="range" min={0} max={100} value={Math.round(style.bgOpacity * 100)} onChange={(e) => setStyle({ ...style, bgOpacity: Number(e.target.value) / 100 })} className="w-full accent-amber-500" />
              </div>
              <div>
                <div className="mb-1 text-white/40">حاشیه</div>
                <button onClick={() => setStyle({ ...style, outline: !style.outline })} className={`rounded-lg px-3 py-1 transition ${style.outline ? 'bg-amber-500 font-bold text-black' : 'bg-white/5 text-white/50'}`}>{style.outline ? 'روشن' : 'خاموش'}</button>
              </div>
              <div>
                <div className="mb-1 text-white/40">مکان</div>
                <button onClick={() => setStyle({ ...style, x: null, y: null })} className="rounded-lg bg-white/5 px-3 py-1 text-white/60 transition hover:bg-white/10">پیش‌فرض</button>
              </div>
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="lg:col-span-2">
          <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-zinc-900/60">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3 text-xs">
              <strong className="text-white/80">کپشن‌ها ({segments.length})</strong>
              <div className="ms-auto flex items-center gap-1.5">
                <input placeholder="جستجو" value={findQ} onChange={(e) => setFindQ(e.target.value)} className="w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-white/70 placeholder:text-white/30 focus:border-amber-500/50 focus:outline-none" />
                <input placeholder="جایگزینی" value={replQ} onChange={(e) => setReplQ(e.target.value)} className="w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-white/70 placeholder:text-white/30 focus:border-amber-500/50 focus:outline-none" />
                <button onClick={findReplace} className="rounded-lg bg-amber-500 px-2.5 py-1 font-bold text-black transition hover:bg-amber-400">اعمال</button>
              </div>
            </div>
            <div className="max-h-[26rem] flex-1 space-y-1 overflow-y-auto p-2 lg:max-h-[34rem]">
              {segments.map((s, i) => (
                <div
                  key={i}
                  onClick={() => { setSelected(i); seek(s.start) }}
                  className={`group cursor-pointer rounded-xl border-r-2 p-2.5 transition ${
                    time >= s.start && time <= s.end
                      ? 'border-amber-500 bg-amber-500/10'
                      : i === selected
                      ? 'border-white/30 bg-white/5'
                      : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span className={`font-mono ${time >= s.start && time <= s.end ? 'text-amber-300' : 'text-white/40'}`}>
                      {fmt(s.start)} – {fmt(s.end)}
                    </span>
                    {cps(s) > 22 && <span className="text-amber-400" title="سرعت خواندن زیاد">⚠ تند</span>}
                    <select value={s.fx || 'none'} onClick={(e) => e.stopPropagation()} onChange={(e) => updateSeg(i, { fx: e.target.value as Fx })} className="rounded-md border border-white/10 bg-black/40 p-0.5 text-white/60">
                      <option value="none">بدون افکت</option>
                      <option value="pop">پاپ</option>
                      <option value="zoomIn">زوم این</option>
                      <option value="zoomOut">زوم اوت</option>
                      <option value="slide">اسلاید</option>
                    </select>
                    <div className="flex items-center gap-1">
                      {HL_COLORS.map((c) => (
                        <button key={c || 'none'} onClick={(e) => { e.stopPropagation(); updateSeg(i, { hl: c || undefined }) }} className={`h-3.5 w-3.5 rounded-full border ${(s.hl || '') === c ? 'border-white' : 'border-white/20'}`} style={{ backgroundColor: c || 'transparent' }} />
                      ))}
                    </div>
                    <div className="ms-auto flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <button title="تقسیم" onClick={(e) => { e.stopPropagation(); splitSeg(i) }} className="rounded-md bg-white/10 px-1.5 text-white/60 hover:text-white">✂️</button>
                      <button title="ادغام" onClick={(e) => { e.stopPropagation(); mergeSeg(i) }} className="rounded-md bg-white/10 px-1.5 text-white/60 hover:text-white">🔗</button>
                      <button title="حذف" onClick={(e) => { e.stopPropagation(); snapshot(); setSegments(segments.filter((_, idx) => idx !== i)) }} className="rounded-md bg-white/10 px-1.5 text-red-400 hover:text-red-300">✕</button>
                    </div>
                  </div>
                  <textarea
                    value={s.text} rows={1}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateSeg(i, { text: e.target.value })}
                    className="mt-1.5 w-full resize-y bg-transparent text-sm leading-6 text-white/90 outline-none placeholder:text-white/30"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Timeline ── */}
      {duration > 0 && (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-3">
          <div className="mb-2 flex items-center gap-3 text-[10px] text-white/40">
            <span>تایم‌لاین</span>
            <input type="range" min={10} max={120} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-24 accent-amber-500" title="بزرگ‌نمایی" />
            <span className="ms-auto font-mono text-amber-300/80">{fmt(time)} / {fmt(duration)}</span>
          </div>
          <div className="overflow-x-auto rounded-xl bg-black/50 p-2">
            <div
              className="relative h-14"
              style={{ width: Math.max(300, duration * zoom) }}
              onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                seek(Math.max(0, Math.min(duration, (e.clientX - rect.left) / zoom)))
              }}
            >
              {segments.map((s, i) => (
                <div
                  key={i}
                  onPointerDown={(e) => { e.stopPropagation(); setSelected(i); seek(s.start) }}
                  title={s.text}
                  className={`absolute top-2 h-7 cursor-pointer overflow-hidden rounded-md border px-1 text-center text-[9px] leading-7 transition ${
                    i === selected
                      ? 'border-amber-400 bg-amber-500/40 text-white'
                      : time >= s.start && time <= s.end
                      ? 'border-amber-500/60 bg-amber-500/20 text-amber-100'
                      : 'border-white/10 bg-white/10 text-white/50 hover:bg-white/20'
                  }`}
                  style={{ left: s.start * zoom, width: Math.max(14, (s.end - s.start) * zoom) }}
                >
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      const startX = e.clientX, origStart = s.start
                      const move = (ev: PointerEvent) => updateSeg(i, { start: Math.max(0, origStart + (ev.clientX - startX) / zoom) }, false)
                      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
                      snapshot()
                      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
                    }}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-amber-400/60"
                  />
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      const startX = e.clientX, origEnd = s.end
                      const move = (ev: PointerEvent) => updateSeg(i, { end: Math.max(s.start + 0.3, origEnd + (ev.clientX - startX) / zoom) }, false)
                      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
                      snapshot()
                      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
                    }}
                    className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-amber-400/60"
                  />
                </div>
              ))}
              <div className="pointer-events-none absolute top-0 h-full w-0.5 bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" style={{ left: time * zoom }} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
