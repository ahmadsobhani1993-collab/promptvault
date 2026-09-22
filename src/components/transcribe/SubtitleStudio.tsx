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

type AspectRatio = 'original' | '9:16' | '1:1' | '16:9'

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
  const [showAdv, setShowAdv] = useState(false) // پیش‌فرض بسته: روی موبایل جا نگیرد
  const [translating, setTranslating] = useState(false)
  const [showTransMenu, setShowTransMenu] = useState(false)
  const [manualEnd, setManualEnd] = useState('')

  const transMenuRef = useRef<HTMLDivElement>(null)

  // بستن منوی ترجمه با کلیک بیرون از آن
  useEffect(() => {
    if (!showTransMenu) return
    const onDocClick = (e: MouseEvent) => {
      if (transMenuRef.current && !transMenuRef.current.contains(e.target as Node)) {
        setShowTransMenu(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showTransMenu])

  const translateSubtitles = async (targetLang: 'fa' | 'en') => {
    if (!segments || segments.length === 0 || translating) return
    setTranslating(true)
    setShowTransMenu(false)
    try {
      const pad = (n: number, z = 2) => String(Math.floor(n)).padStart(z, '0')
      const fmtTime = (sec: number) => {
        const s = Math.max(0, Number(sec) || 0)
        const h = pad(s / 3600)
        const m = pad((s % 3600) / 60)
        const sc = pad(s % 60)
        const ms = pad((s % 1) * 1000, 3)
        return `${h}:${m}:${sc},${ms}`
      }

      const srt = segments.map((s, i) => `${i + 1}\n${fmtTime(s.start)} --> ${fmtTime(s.end)}\n${s.text}`).join('\n\n')

      const res = await fetch('/api/translate-srt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ srtContent: srt, targetLang }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'خطای دریافت ترجمه')
      }

      if (data.srt) {
        const blocks = data.srt.trim().replace(/\r\n/g, '\n').split(/\n\s*\n/)
        const parsedTexts: string[] = []

        for (const block of blocks) {
          const lines = block.trim().split('\n')
          if (lines.length >= 3) {
            parsedTexts.push(lines.slice(2).join(' ').trim())
          }
        }

        snapshot()

        const updated = segments.map((seg, idx) => {
          const newTxt = parsedTexts[idx] || seg.text
          const newWords = typeof mkWords === 'function' ? mkWords(newTxt, seg.start, seg.end) : []
          return { ...seg, text: newTxt, words: newWords }
        })

        setSegments(updated)

        setStyle((prev: any) => ({
          ...prev,
          direction: targetLang === 'fa' ? 'rtl' : 'ltr',
          fontFamily: targetLang === 'fa'
            ? (prev?.fontFamily?.includes('Lalezar') ? prev.fontFamily : 'Vazirmatn, system-ui, sans-serif')
            : 'Inter, system-ui, sans-serif'
        }))
      }
    } catch (e: any) {
      console.error('[TRANSLATE RUNTIME ERROR]:', e)
      alert('خطا در فرآیند ترجمه: ' + (e.message || 'پاسخی از سرور دریافت نشد'))
    } finally {
      setTranslating(false)
    }
  }

  const [aspect, setAspect] = useState<AspectRatio>('original')
  const [findQ, setFindQ] = useState('')
  const [replQ, setReplQ] = useState('')
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })

  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const histRef = useRef<string[]>([])
  const futRef = useRef<string[]>([])
  const skipPersistRef = useRef(true)

  useEffect(() => { loadFont(style.fontId) }, [style.fontId])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('promptvault.subtitle.style')
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved && typeof saved === 'object') {
          setStyle((s) => ({ ...s, ...saved }))
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false
      return
    }
    try {
      localStorage.setItem('promptvault.subtitle.style', JSON.stringify(style))
    } catch {}
  }, [style])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const update = () => {
      const r = stage.getBoundingClientRect()
      setStageSize({ width: r.width, height: r.height })
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(stage)
    window.addEventListener('resize', update)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [aspect])

  const current = segments.find((s) => time >= s.start && time <= s.end)

  const videoFrame = (() => {
    const sw = stageSize.width || stageRef.current?.clientWidth || 0
    const sh = stageSize.height || stageRef.current?.clientHeight || 0

    if (!sw || !sh || !vidW || !vidH) {
      return { left: 0, top: 0, width: sw, height: sh }
    }

    const scale = Math.min(sw / vidW, sh / vidH)
    const width = vidW * scale
    const height = vidH * scale

    return {
      left: (sw - width) / 2,
      top: (sh - height) / 2,
      width,
      height,
    }
  })()

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

  const activeIdx = () => (selected !== -1 ? selected : segments.findIndex((s) => time >= s.start && time <= s.end))

  const endActiveSegmentHere = () => {
    const targetIdx = activeIdx()
    if (targetIdx === -1) return
    const s = segments[targetIdx]
    if (time <= s.start) return

    snapshot()
    updateSeg(targetIdx, { end: Number(time.toFixed(2)) }, false)
  }

  // تنظیم دستی و عددی زمان پایان کپشن انتخاب‌شده
  const applyManualEnd = () => {
    const idx = activeIdx()
    if (idx === -1 || manualEnd === '') return
    const val = Number(manualEnd)
    if (Number.isNaN(val)) return
    updateSeg(idx, { end: Math.max(segments[idx].start + 0.1, val) })
    setManualEnd('')
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
      if (e.shiftKey && e.key.toLowerCase() === 'e') { e.preventDefault(); endActiveSegmentHere() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const seek = (t: number) => { if (videoRef.current) videoRef.current.currentTime = t }

  const onSubPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    const stage = stageRef.current
    if (!stage || !videoFrame.width || !videoFrame.height) return

    const rect = stage.getBoundingClientRect()
    const frame = {
      left: rect.left + videoFrame.left,
      top: rect.top + videoFrame.top,
      width: videoFrame.width,
      height: videoFrame.height,
    }

    const move = (ev: globalThis.PointerEvent) => {
      const rawX = ((ev.clientX - frame.left) / frame.width) * 100
      const rawY = ((ev.clientY - frame.top) / frame.height) * 100
      const x = Math.min(98, Math.max(2, rawX))
      const y = Math.min(98, Math.max(2, rawY))
      setStyle((s) => ({ ...s, x, y }))
    }

    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }

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
      if (patch.text !== undefined || patch.start !== undefined || patch.end !== undefined) {
        next.words = mkWords(next.text, next.start, next.end)
      }
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

  const fxAnim = (seg: Seg) => {
    const dur = Math.max(0.3, seg.end - seg.start)
    if (seg.fx === 'pop') return 'subPop 0.35s ease-out both'
    if (seg.fx === 'zoomIn') return `subZoomIn ${dur}s linear both`
    if (seg.fx === 'zoomOut') return `subZoomOut ${dur}s linear both`
    if (seg.fx === 'slide') return 'subSlide 0.4s ease-out both'
    return undefined
  }

  const getAspectClass = () => {
    if (aspect === '9:16') return 'aspect-[9/16] max-h-[420px] mx-auto'
    if (aspect === '1:1') return 'aspect-square max-h-[380px] mx-auto'
    if (aspect === '16:9') return 'aspect-video w-full'
    return 'aspect-video w-full'
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative flex items-center gap-1.5">
          <button onClick={undo} title="واگرد (Ctrl+Z)" className={iconBtn}>↩</button>
          <button onClick={redo} title="ازنو (Ctrl+Shift+Z)" className={iconBtn}>↪</button>
          <button onClick={() => setShowSafe(!showSafe)} title="ناحیه امن اینستاگرام" className={`${iconBtn} ${showSafe ? '!border-amber-500/60 !text-amber-300' : ''}`}>▦</button>

          <div className="relative" ref={transMenuRef}>
            <button
              onClick={() => setShowTransMenu((v) => !v)}
              disabled={translating}
              title="ترجمه هوشمند زیرنویس"
              className={`${iconBtn} ${translating ? '!border-amber-500 text-amber-400 animate-pulse' : ''}`}
            >
              🌐
            </button>
            {showTransMenu && (
              <div className="absolute top-full mt-1.5 z-50 flex flex-col gap-1 rounded-xl border border-white/10 bg-neutral-900 p-1.5 shadow-2xl min-w-[130px]" dir="rtl">
                <button onClick={() => translateSubtitles('fa')} className="rounded-lg px-2.5 py-1.5 text-right text-xs text-white/80 transition hover:bg-amber-500 hover:text-black font-medium">
                  انگلیسی ➔ فارسی
                </button>
                <button onClick={() => translateSubtitles('en')} className="rounded-lg px-2.5 py-1.5 text-right text-xs text-white/80 transition hover:bg-amber-500 hover:text-black font-medium">
                  فارسی ➔ انگلیسی
                </button>
              </div>
            )}
          </div>

          <button onClick={() => setShowAdv(!showAdv)} title="تنظیمات استایل" className={`${iconBtn} ${showAdv ? '!border-amber-500/60 !text-amber-300' : ''}`}>⚙</button>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-zinc-900/60 p-1 text-xs">
          <span className="px-1 text-[10px] text-white/40">کادر:</span>
          {(['original', '9:16', '1:1', '16:9'] as const).map((ratio) => (
            <button
              key={ratio}
              onClick={() => setAspect(ratio)}
              className={`rounded px-2 py-0.5 text-[11px] transition ${
                aspect === ratio ? 'bg-amber-500 font-bold text-black' : 'text-white/60 hover:bg-white/10'
              }`}
            >
              {ratio === 'original' ? 'اصلی' : ratio}
            </button>
          ))}
        </div>

        {vidW > 0 && (
          <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] text-white/40">
            {vidW}×{vidH} — اصلی
          </span>
        )}
      </div>

      {/* ─── Workspace ── */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">

          {/* فقط ویدیو sticky می‌شود — نه پریست‌ها و نه پنل تنظیمات پیشرفته،
              وگرنه روی موبایل کل صفحه را می‌گیرد و کپشن‌ها دوباره از دید خارج می‌شوند */}
          <div className="sticky top-2 z-20 -mx-4 bg-neutral-950/95 px-4 pb-2 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:pb-0">
            <div ref={stageRef} className={`relative select-none overflow-hidden rounded-2xl border border-white/10 bg-black ${getAspectClass()}`} style={{ containerType: 'inline-size' }}>
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
              {current && videoFrame.width > 0 && (
                <div className="absolute pointer-events-none overflow-hidden"
                  style={{ left: videoFrame.left, top: videoFrame.top, width: videoFrame.width, height: videoFrame.height }}
                >
                  <div onPointerDown={onSubPointerDown} className="absolute pointer-events-auto cursor-grab active:cursor-grabbing" style={{
                      left: `${style.x ?? 50}%`,
                      top: `${style.y ?? 90}%`,
                      transform: 'translate(-50%,-50%)',
                      width: `${Math.max(8, Math.min(96, 2 * Math.min(style.x ?? 50, 100 - (style.x ?? 50))))}%`,
                    }}
                  >
                    <span
                      key={current.start + current.text}
                      dir={style.direction || 'auto'}
                      className="block w-full text-center whitespace-pre-wrap break-words"
                      style={{
                        fontFamily: `"${style.fontId}"`,
                        fontWeight: 700,
                        fontSize: `${(style.size / 100) * videoFrame.width}px`,
                        lineHeight: 1.25,
                        color: style.color,
                        backgroundColor: current.hl || (style.bgOpacity > 0 ? `rgba(0,0,0,${style.bgOpacity})` : 'transparent'),
                        padding: '0.2em 0.6em',
                        borderRadius: '0.5em',
                        boxSizing: 'border-box',
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
                </div>
              )}
            </div>
          </div>

          {/* از اینجا به بعد داخل ناحیه‌ی sticky نیست و به‌طور عادی اسکرول می‌شود */}
          <p className="hidden text-[10px] text-white/30 lg:block">💡 کپشن را با ماوس بگیر و در تصویر جابه‌جا کن</p>

          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.id} onClick={() => applyPreset(p)} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 transition hover:border-amber-500/40 hover:text-amber-300">
                {p.label}
              </button>
            ))}
            <label className="cursor-pointer rounded-lg border border-dashed border-white/20 px-2.5 py-1 text-[11px] text-white/50 transition hover:border-amber-500/50 hover:text-amber-300">
              ＋ فونت دلخواه
              <input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={(e) => e.target.files?.[0] && addCustomFont(e.target.files[0])} />
            </label>
          </div>

          {showAdv && (
            <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-white/10 bg-zinc-900/60 p-3 text-xs sm:grid-cols-4 lg:grid-cols-7">
              <div>
                <div className="mb-1 text-white/40">فونت</div>
                <select value={style.fontId} onChange={(e) => setStyle({ ...style, fontId: e.target.value })} className="w-full rounded-lg border border-white/10 bg-black/40 p-1.5 text-white/80">
                  {customFonts.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <div className="mb-1 text-white/40">اندازه: {style.size}٪</div>
                <input type="range" min={1} max={20} step={0.5} value={style.size} onChange={(e) => setStyle({ ...style, size: Number(e.target.value) })} className="w-full accent-amber-500" />
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

        {/* Transcript List */}
        <div className="lg:col-span-2">
          <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-zinc-900/60">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3 text-xs">
              <strong className="text-white/80">کپشن‌ها ({segments.length})</strong>
              <div className="ms-auto flex items-center gap-1.5">
                <input placeholder="جستجو" value={findQ} onChange={(e) => setFindQ(e.target.value)} className="w-16 sm:w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-white/70 placeholder:text-white/30 focus:border-amber-500/50 focus:outline-none" />
                <input placeholder="جایگزینی" value={replQ} onChange={(e) => setReplQ(e.target.value)} className="w-16 sm:w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-white/70 placeholder:text-white/30 focus:border-amber-500/50 focus:outline-none" />
                <button onClick={findReplace} className="rounded-lg bg-amber-500 px-2.5 py-1 font-bold text-black transition hover:bg-amber-400">اعمال</button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 px-3 py-2 text-[10px]">
              <span className="text-white/40">انتقال همه:</span>
              {[-2, -1, -0.5, 0.5, 1, 2].map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    snapshot()
                    setSegments(segments.map((s) => ({
                      ...s,
                      start: Math.max(0, s.start + d),
                      end: s.end + d,
                      words: mkWords(s.text, Math.max(0, s.start + d), s.end + d),
                    })))
                  }}
                  className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-white/70 transition hover:border-amber-500/40 hover:text-amber-300"
                >
                  {d > 0 ? `+${d}` : d}s
                </button>
              ))}
              <button onClick={() => { snapshot(); setSegments([]) }} className="mr-auto rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-red-400 transition hover:bg-red-500/20">
                پاک کردن
              </button>
            </div>

            <div className="max-h-[30rem] flex-1 space-y-2 overflow-y-auto p-2 lg:max-h-[36rem]">
              {segments.map((s, i) => (
                <div
                  key={i}
                  onClick={() => { setSelected(i); seek(s.start) }}
                  className={`group rounded-xl border-r-2 p-2.5 transition ${
                    time >= s.start && time <= s.end
                      ? 'border-amber-500 bg-amber-500/10'
                      : i === selected
                      ? 'border-white/30 bg-white/5'
                      : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]" onClick={(e) => e.stopPropagation()}>
                    <span className="text-white/40">از</span>
                    <input
                      type="number" step="0.1" min="0"
                      value={Number(s.start.toFixed(1))}
                      onChange={(e) => updateSeg(i, { start: Math.max(0, Number(e.target.value)) })}
                      className="w-16 rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-white/90 focus:border-amber-500/50 focus:outline-none"
                    />
                    <span className="text-white/40">تا</span>
                    <input
                      type="number" step="0.1" min="0"
                      value={Number(s.end.toFixed(1))}
                      onChange={(e) => updateSeg(i, { end: Math.max(s.start + 0.1, Number(e.target.value)) })}
                      className="w-16 rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-white/90 focus:border-amber-500/50 focus:outline-none"
                    />
                    <span className="text-white/40">ثانیه</span>

                    <div className="flex items-center gap-0.5">
                      {[-0.5, -0.1, 0.1, 0.5].map((d) => (
                        <button key={d} onClick={() => updateSeg(i, { start: Math.max(0, s.start + d), end: s.end + d })} className="rounded-md bg-white/5 px-1 py-0.5 font-mono text-[10px] text-white/60 hover:bg-white/10 hover:text-white">
                          {d > 0 ? `+${d}` : d}
                        </button>
                      ))}
                    </div>

                    <div className="ms-auto flex items-center gap-1">
                      <button onClick={() => seek(s.start)} className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-amber-300 hover:bg-amber-500/30" title="پرش به ابتدا">▶</button>
                      <button onClick={() => { snapshot(); updateSeg(i, { start: time }, false) }} className="rounded-md bg-white/10 px-1.5 py-0.5 text-white/70 hover:bg-white/20" title="شروع از زمان فعلی">S</button>
                      <button onClick={() => { snapshot(); updateSeg(i, { end: time }, false) }} className="rounded-md bg-white/10 px-1.5 py-0.5 text-white/70 hover:bg-white/20" title="پایان در زمان فعلی">E</button>
                    </div>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]" onClick={(e) => e.stopPropagation()}>
                    <select value={s.fx || 'none'} onChange={(e) => updateSeg(i, { fx: e.target.value as Fx })} className="rounded-md border border-white/10 bg-black/40 p-0.5 text-white/60">
                      <option value="none">بدون افکت</option>
                      <option value="pop">پاپ</option>
                      <option value="zoomIn">زوم این</option>
                      <option value="zoomOut">زوم اوت</option>
                      <option value="slide">اسلاید</option>
                    </select>
                    <div className="flex items-center gap-1">
                      {HL_COLORS.map((c) => (
                        <button key={c || 'none'} onClick={() => updateSeg(i, { hl: c || undefined })} className={`h-3.5 w-3.5 rounded-full border ${(s.hl || '') === c ? 'border-white' : 'border-white/20'}`} style={{ backgroundColor: c || 'transparent' }} />
                      ))}
                    </div>
                    <button title="تقسیم" onClick={() => splitSeg(i)} className="rounded-md bg-white/10 px-1.5 text-white/60 hover:text-white">✂️</button>
                    <button title="ادغام با بعدی" onClick={() => mergeSeg(i)} className="rounded-md bg-white/10 px-1.5 text-white/60 hover:text-white">🔗</button>
                    <button title="حذف" onClick={() => { snapshot(); setSegments(segments.filter((_, idx) => idx !== i)) }} className="mr-auto rounded-md bg-white/10 px-1.5 text-red-400 hover:text-red-300">✕</button>
                  </div>

                  <textarea
                    value={s.text}
                    rows={1}
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
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-3 select-none" dir="rtl">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-white/40">
            <span className="font-bold text-white/70">تایم‌لاین</span>
            <input type="range" min={15} max={120} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-24 accent-amber-500" title="بزرگ‌نمایی" />

            <button
              onClick={endActiveSegmentHere}
              className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-bold text-amber-300 transition hover:bg-amber-500/20"
              title="توقف کپشن در زمان فعلی ویدیو (Shift+E)"
            >
              ⏱️ پایان در همین ثانیه ({fmt(time)})
            </button>

            {/* تنظیم دستی و عددی زمان پایان */}
            <div className="flex items-center gap-1">
              <input
                type="number" step="0.1" placeholder="عدد دقیق"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                className="w-20 rounded-md border border-white/10 bg-black/40 px-1.5 py-1 font-mono text-[10px] text-white/80 focus:border-amber-500/50 focus:outline-none"
              />
              <button
                onClick={applyManualEnd}
                className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-[10px] text-white/70 transition hover:border-amber-500/40 hover:text-amber-300"
                title="زمان پایان کپشن انتخاب‌شده را دقیقاً به این عدد تنظیم کن"
              >
                تنظیم دقیق
              </button>
            </div>

            <span className="ms-auto font-mono text-amber-300/80">{fmt(time)} / {fmt(duration)}</span>
          </div>

          <div className="overflow-x-auto rounded-xl bg-black/50 p-2 touch-pan-x" dir="ltr">
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
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    setSelected(i)
                    seek(s.start)
                    const startX = e.clientX
                    const origStart = s.start
                    const segLen = s.end - s.start
                    const prevSeg = segments[i - 1]
                    const nextSeg = segments[i + 1]

                    const move = (ev: globalThis.PointerEvent) => {
                      const deltaSec = (ev.clientX - startX) / zoom
                      // محدود به بازه‌ی ۰ تا پایان ویدیو
                      let nextStart = Math.max(0, Math.min(duration - segLen, origStart + deltaSec))

                      // اسنپ مغناطیسی، هماهنگ با دستگیره‌های لبه
                      if (prevSeg && Math.abs(nextStart - prevSeg.end) < 0.15) nextStart = prevSeg.end
                      if (nextSeg && Math.abs(nextStart + segLen - nextSeg.start) < 0.15) nextStart = nextSeg.start - segLen
                      if (Math.abs(nextStart - time) < 0.12) nextStart = time

                      updateSeg(i, { start: Number(nextStart.toFixed(2)), end: Number((nextStart + segLen).toFixed(2)) }, false)
                    }

                    const up = () => {
                      window.removeEventListener('pointermove', move)
                      window.removeEventListener('pointerup', up)
                    }

                    snapshot()
                    window.addEventListener('pointermove', move)
                    window.addEventListener('pointerup', up)
                  }}
                  title={s.text}
                  className={`absolute top-2 h-8 cursor-grab active:cursor-grabbing overflow-hidden rounded-md border text-center text-[10px] leading-8 transition touch-none ${
                    i === selected
                      ? 'border-amber-400 bg-amber-500/40 text-white z-10'
                      : time >= s.start && time <= s.end
                      ? 'border-amber-500/60 bg-amber-500/20 text-amber-100'
                      : 'border-white/10 bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                  style={{ left: s.start * zoom, width: Math.max(16, (s.end - s.start) * zoom) }}
                >
                  <span className="truncate block px-2 pointer-events-none">{s.text}</span>

                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      const startX = e.clientX
                      const origStart = s.start
                      const prevSeg = segments[i - 1]

                      const move = (ev: globalThis.PointerEvent) => {
                        const deltaSec = (ev.clientX - startX) / zoom
                        let newStart = Math.max(0, Math.min(s.end - 0.2, origStart + deltaSec))
                        if (prevSeg && Math.abs(newStart - prevSeg.end) < 0.15) newStart = prevSeg.end
                        if (Math.abs(newStart - time) < 0.12) newStart = time
                        updateSeg(i, { start: Number(newStart.toFixed(2)) }, false)
                      }
                      const up = () => {
                        window.removeEventListener('pointermove', move)
                        window.removeEventListener('pointerup', up)
                      }
                      snapshot()
                      window.addEventListener('pointermove', move)
                      window.addEventListener('pointerup', up)
                    }}
                    className="absolute left-0 top-0 h-full w-2.5 cursor-ew-resize bg-amber-400/80 hover:w-3.5 transition-all touch-none"
                    title="کشیدن لبه شروع"
                  />

                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      const startX = e.clientX
                      const origEnd = s.end
                      const nextSeg = segments[i + 1]

                      const move = (ev: globalThis.PointerEvent) => {
                        const deltaSec = (ev.clientX - startX) / zoom
                        let newEnd = Math.max(s.start + 0.2, Math.min(duration, origEnd + deltaSec))
                        if (nextSeg && Math.abs(newEnd - nextSeg.start) < 0.15) newEnd = nextSeg.start
                        if (Math.abs(newEnd - time) < 0.12) newEnd = time
                        updateSeg(i, { end: Number(newEnd.toFixed(2)) }, false)
                      }
                      const up = () => {
                        window.removeEventListener('pointermove', move)
                        window.removeEventListener('pointerup', up)
                      }
                      snapshot()
                      window.addEventListener('pointermove', move)
                      window.addEventListener('pointerup', up)
                    }}
                    className="absolute right-0 top-0 h-full w-2.5 cursor-ew-resize bg-amber-400/80 hover:w-3.5 transition-all touch-none"
                    title="کشیدن لبه پایان"
                  />
                </div>
              ))}

              <div
                className="pointer-events-none absolute top-0 h-full w-0.5 bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)] z-20"
                style={{ left: time * zoom }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
