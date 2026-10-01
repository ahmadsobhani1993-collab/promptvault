'use client'
import { useRef } from 'react'
import { PRESETS, FONTS } from './constants'
import { Preset, Snapshot } from './types'
import { ensureFontLoaded, listUploadedFonts, saveUploadedFont, type UploadedSubtitleFont } from '@/lib/studio/font-loader'
import { deleteSubtitleTemplate, getSavedSubtitleTemplates, saveSubtitleTemplate, type SavedSubtitleTemplate, type WatermarkOverlay } from '@/lib/studio/unified-style'
import { useEffect, useState } from 'react'

function toHexColor(color: string, fallback = '#000000'): string {
  const hex = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1]
  if (hex) return hex.length === 3 ? `#${hex.split('').map(char => char + char).join('')}` : `#${hex}`
  const rgb = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  return rgb ? `#${[rgb[1], rgb[2], rgb[3]].map(value => Number(value).toString(16).padStart(2, '0')).join('')}` : fallback
}

interface Props {
  style: Record<string, any>
  fontId: string
  onClose: () => void
  onApplyPreset: (preset: Preset) => void
  onApplyFont: (id: string) => void
  onUpdateStyle: (patch: Record<string, unknown>, record?: boolean) => void
  makeSnapshot: () => Snapshot
  recordBefore: (snapshot?: Snapshot) => void
}

export default function StylePanel({ 
  style, fontId, onClose, onApplyPreset, onApplyFont, onUpdateStyle, makeSnapshot, recordBefore 
}: Props) {
  const x = Number(style.positionXPercent ?? style.x ?? 50)
  const y = Number(style.positionYPercent ?? style.y ?? 82)
  const beforeStyleDragRef = useRef<Snapshot | null>(null)
  const [fontsReady, setFontsReady] = useState(false)
  const [customTemplates, setCustomTemplates] = useState<SavedSubtitleTemplate[]>([])
  const [templateName, setTemplateName] = useState('قالب من')
  const [uploadedFonts, setUploadedFonts] = useState<UploadedSubtitleFont[]>([])
  const [fontError, setFontError] = useState('')
  const [watermarkTextDraft, setWatermarkTextDraft] = useState('نام پیج شما')

  const refreshFonts = async () => {
    try { setUploadedFonts(await listUploadedFonts()) } catch { setFontError('خواندن فونت‌های ذخیره‌شده ناموفق بود.') }
  }

  useEffect(() => {
    let active = true
    setCustomTemplates(getSavedSubtitleTemplates())
    refreshFonts()
    Promise.all(FONTS.map(font => ensureFontLoaded(font.id))).finally(() => active && setFontsReady(true))
    return () => { active = false }
  }, [])

  const handleDragStart = () => { beforeStyleDragRef.current = makeSnapshot() }
  const handleDragEnd = () => { 
    if (beforeStyleDragRef.current) {
      recordBefore(beforeStyleDragRef.current)
      beforeStyleDragRef.current = null
    }
  }

  const handleFontUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setFontError('')
    try {
      const font = await saveUploadedFont(file)
      setUploadedFonts(await listUploadedFonts())
      onApplyFont(font.family)
    } catch (error: any) {
      setFontError(error?.message || 'بارگذاری فونت انجام نشد.')
    }
  }

  const handleSaveTemplate = () => {
    const name = templateName.trim()
    if (!name) return
    const templateId = `custom_${crypto.randomUUID()}`
    const template: SavedSubtitleTemplate = {
      id: templateId,
      name,
      style: { ...style, templateId },
      savedAt: Date.now(),
    }
    try {
      onUpdateStyle({ templateId: template.style.templateId })
      setCustomTemplates(saveSubtitleTemplate(template))
    } catch {
      setFontError('ذخیرهٔ قالب ممکن نشد؛ فضای ذخیره‌سازی مرورگر را بررسی کنید.')
    }
  }

  const updateWatermark = (id: string, patch: Partial<WatermarkOverlay>) => {
    const watermarks = (Array.isArray(style.watermarks) ? style.watermarks : []).map((item: WatermarkOverlay) => item.id === id ? { ...item, ...patch } : item)
    onUpdateStyle({ watermarks })
  }

  const addWatermark = (type: 'text' | 'sticker', sticker = '✨') => {
    const value = type === 'text' ? watermarkTextDraft.trim() : sticker
    if (!value) return
    const watermark: WatermarkOverlay = {
      id: `watermark_${crypto.randomUUID()}`,
      type,
      value,
      x: 82,
      y: 12,
      size: type === 'sticker' ? 5 : 2.5,
      opacity: 0.7,
      color: '#ffffff',
      rotation: 0,
      fontFamily: style.fontFamily || fontId,
    }
    onUpdateStyle({ watermarks: [...(style.watermarks ?? []), watermark] })
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/70" onMouseDown={onClose}>
      <section 
        onMouseDown={e => e.stopPropagation()} 
        className="absolute inset-y-0 left-0 w-full max-w-[430px] overflow-y-auto border-r border-stone-800 bg-[#12100d] shadow-2xl"
      >
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-800 bg-[#12100d] p-4">
          <div>
            <h2 className="text-sm font-black">استایل زیرنویس</h2>
            <p className="text-[10px] text-stone-500">قالب، فونت و تنظیمات در یک‌جا</p>
          </div>
          <button onClick={onClose} className="rounded-lg bg-stone-800 px-3 py-1.5">✕</button>
        </div>
        
        <div className="space-y-6 p-4">
          {/* قالب‌ها */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold">قالب‌ها</h3>
              <span className="text-[10px] text-stone-500">{PRESETS.length} قالب</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => onApplyPreset(p)} 
                  className={`rounded-xl border p-2 text-right transition-all ${
                    style.templateId === p.id ? 'border-amber-400 bg-amber-500/10' : 'border-stone-800 bg-stone-900/60'
                  }`}
                >
                  <div className="mb-2 flex min-h-16 items-center justify-center rounded-lg px-2 py-3 text-center" style={{ background: p.bgOpacity > 0 ? p.bgColor : 'transparent', borderRadius: p.bgRadius, boxShadow: p.outline ? `0 0 8px ${p.textShadowColor}` : 'none' }}>
                    <span dir="rtl" style={{ fontFamily: `"${p.fontId}", sans-serif`, color: p.color, fontSize: 15 * p.size / 6, fontWeight: p.id === 'bold' || p.id === 'viral' ? 900 : 700, textShadow: p.outline ? `0 0 ${Math.max(2, p.textShadowBlur / 2)}px ${p.textShadowColor}` : 'none' }}>
                      این فونت چه حالی به نوشته می‌دهد؟
                    </span>
                  </div>
                  <div className="text-[11px] font-bold">{p.name}</div>
                  <div className="mt-1 text-[9px] text-stone-500">{p.fontId}{!fontsReady ? ' · در حال بارگذاری فونت' : ''}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-3">
            <div>
              <h3 className="text-xs font-bold text-purple-200">استودیوی ساخت قالب</h3>
              <p className="mt-1 text-[10px] leading-5 text-stone-500">تنظیمات فعلی را با نام دلخواه ذخیره کن؛ قالب روی تمام باکس‌های زیرنویس اعمال می‌شود.</p>
            </div>
            <div className="flex gap-2">
              <input value={templateName} onChange={event => setTemplateName(event.target.value)} maxLength={32} aria-label="نام قالب شخصی" className="min-w-0 flex-1 rounded-lg border border-stone-700 bg-black/40 px-2 py-2 text-xs text-white outline-none focus:border-purple-400" />
              <button type="button" onClick={handleSaveTemplate} className="shrink-0 rounded-lg bg-purple-500/20 px-3 py-2 text-xs font-bold text-purple-200">ذخیره قالب من</button>
            </div>
            {customTemplates.length > 0 && <div className="space-y-1.5">
              {customTemplates.map(template => (
                <div key={template.id} className="flex items-center gap-2 rounded-lg border border-stone-800 bg-black/30 p-2">
                  <button type="button" onClick={() => { onUpdateStyle(template.style); if (template.style.fontFamily) onApplyFont(template.style.fontFamily) }} className="min-w-0 flex-1 truncate text-right text-xs text-white">{template.name}</button>
                  <button type="button" aria-label={`حذف ${template.name}`} onClick={() => setCustomTemplates(deleteSubtitleTemplate(template.id))} className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-300">حذف</button>
                </div>
              ))}
            </div>}
          </section>

          {/* فونت‌ها */}
          <section>
            <h3 className="mb-2 text-xs font-bold">فونت‌ها</h3>
            <div className="grid grid-cols-2 gap-2">
              {[...FONTS, ...uploadedFonts.map(font => ({ id: font.family, label: font.name, category: 'آپلودشده' }))].map(f => (
                <button 
                  key={f.id} 
                  onClick={() => onApplyFont(f.id)} 
                  className={`rounded-xl border p-3 text-right transition-all ${
                    fontId === f.id ? 'border-amber-400 bg-amber-500/10' : 'border-stone-800 bg-stone-900/60'
                  }`}
                >
                  <div dir="rtl" style={{ fontFamily: `"${f.id}", sans-serif`, fontSize: 18, fontWeight: 700 }}>
                    <span style={{ color: style.textColor ?? '#fff' }}>یک جملهٔ نمونه با </span><span style={{ color: style.activeWordColor ?? '#f59e0b' }}>این فونت</span>
                  </div>
                  <div className="mt-1 text-[10px] text-stone-500">{f.label} · {f.category}</div>
                </button>
              ))}
            </div>
            <label className="block cursor-pointer rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-center text-xs text-amber-200 transition hover:bg-amber-500/10">
              ⬆ بارگذاری فونت خودم (WOFF / WOFF2 / TTF / OTF)
              <input type="file" accept=".woff,.woff2,.ttf,.otf,font/woff,font/woff2,font/ttf,font/otf" onChange={handleFontUpload} className="hidden" />
            </label>
            {fontError && <p role="alert" className="text-[10px] text-red-300">{fontError}</p>}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-bold">انیمیشن ورود زیرنویس</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'none', label: 'بدون انیمیشن' },
                { id: 'pop', label: '💥 Pop' },
                { id: 'zoomIn', label: '🔎 Zoom In' },
                { id: 'zoomOut', label: '↘ Zoom Out' },
              ].map(animation => (
                <button key={animation.id} onClick={() => onUpdateStyle({ subtitleAnimation: animation.id })} className={`rounded-lg border px-3 py-2 text-xs ${style.subtitleAnimation === animation.id ? 'border-amber-400 bg-amber-500/15 text-amber-300' : 'border-stone-800 bg-stone-900 text-stone-300'}`}>
                  {animation.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-stone-500">افکت هنگام شروع هر باکس پخش می‌شود و در خروجی ویدیو هم اعمال خواهد شد.</p>
          </section>

          {/* اندازه و رنگ */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold">اندازه و رنگ</h3>
            <label className="block text-[10px] text-stone-400">
              اندازه: {Number(style.fontSizePercent ?? 4.8).toFixed(1)}٪ از عرض ویدیو
              <input 
                type="range" 
                min="2" 
                max="12" 
                step=".1" 
                value={Number(style.fontSizePercent ?? 4.8)} 
                onPointerDown={handleDragStart} 
                onChange={e => onUpdateStyle({ fontSizePercent: Number(e.target.value) }, false)} 
                onPointerUp={handleDragEnd} 
                className="mt-2 w-full accent-amber-500" 
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="rounded-lg bg-stone-900 p-2 text-[10px]">
                رنگ متن
                <input 
                  type="color" 
                  value={style.textColor ?? '#ffffff'} 
                  onChange={e => onUpdateStyle({ textColor: e.target.value })} 
                  className="mt-2 h-8 w-full" 
                />
              </label>
              <label className="rounded-lg bg-stone-900 p-2 text-[10px]">
                رنگ کلمه فعال
                <input 
                  type="color" 
                  value={style.activeWordColor ?? '#ffe14d'} 
                  onChange={e => onUpdateStyle({ activeWordColor: e.target.value })} 
                  className="mt-2 h-8 w-full" 
                />
              </label>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-stone-800 bg-stone-900/40 p-3">
            <h3 className="text-xs font-bold">باکس و دورنویس</h3>
            <label className="flex items-center justify-between text-[10px] text-stone-300">
              پس‌زمینهٔ باکس
              <input type="checkbox" checked={Boolean(style.hasBg)} onChange={event => onUpdateStyle({ hasBg: event.target.checked })} className="accent-amber-500" />
            </label>
            <label className="block text-[10px] text-stone-400">
              شفافیت باکس: {Math.round(Number(style.bgOpacity ?? 0.75) * 100)}٪
              <input type="range" min="0" max="1" step="0.01" value={Number(style.bgOpacity ?? 0.75)} onChange={event => onUpdateStyle({ bgOpacity: Number(event.target.value) })} className="mt-2 w-full accent-amber-500" />
            </label>
            <label className="block rounded-lg bg-stone-900 p-2 text-[10px] text-stone-300">رنگ باکس
              <input type="color" value={toHexColor(String(style.bgColor ?? 'rgba(0,0,0,0.75)'))} onChange={event => { const hex = event.target.value; const red = parseInt(hex.slice(1,3),16); const green = parseInt(hex.slice(3,5),16); const blue = parseInt(hex.slice(5,7),16); onUpdateStyle({ bgColor: `rgba(${red},${green},${blue},${Number(style.bgOpacity ?? 0.75)})` }) }} className="mt-2 h-8 w-full" />
            </label>
            <label className="block text-[10px] text-stone-400">
              گردی گوشه‌ها: {Number(style.bgRadius ?? 14)}px
              <input type="range" min="0" max="48" value={Number(style.bgRadius ?? 14)} onChange={event => onUpdateStyle({ bgRadius: Number(event.target.value) })} className="mt-2 w-full accent-amber-500" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="rounded-lg bg-stone-900 p-2 text-[10px]">رنگ مرز باکس
                <input type="color" value={style.bgBorderColor ?? '#ffffff'} onChange={event => onUpdateStyle({ bgBorderColor: event.target.value })} className="mt-2 h-8 w-full" />
              </label>
              <label className="rounded-lg bg-stone-900 p-2 text-[10px]">ضخامت مرز: {Number(style.bgBorderWidth ?? 0)}px
                <input type="range" min="0" max="12" step="1" value={Number(style.bgBorderWidth ?? 0)} onChange={event => onUpdateStyle({ bgBorderWidth: Number(event.target.value) })} className="mt-2 w-full accent-amber-500" />
              </label>
              <label className="rounded-lg bg-stone-900 p-2 text-[10px]">رنگ دور نوشته
                <input type="color" value={style.textStrokeColor ?? '#000000'} onChange={event => onUpdateStyle({ textStrokeColor: event.target.value })} className="mt-2 h-8 w-full" />
              </label>
              <label className="rounded-lg bg-stone-900 p-2 text-[10px]">ضخامت دور: {Number(style.textStrokeWidth ?? 2)}px
                <input type="range" min="0" max="12" step="0.5" value={Number(style.textStrokeWidth ?? 2)} onChange={event => onUpdateStyle({ textStrokeWidth: Number(event.target.value), hasTextStroke: Number(event.target.value) > 0 })} className="mt-2 w-full accent-amber-500" />
              </label>
            </div>
            <label className="flex items-center justify-between text-[10px] text-stone-300">
              دور نوشته روشن
              <input type="checkbox" checked={Boolean(style.hasTextStroke)} onChange={event => onUpdateStyle({ hasTextStroke: event.target.checked })} className="accent-amber-500" />
            </label>
          </section>

          <section className="grid grid-cols-2 gap-2 rounded-xl border border-stone-800 bg-stone-900/40 p-3">
            <label className="text-[10px] text-stone-400">چینش متن
              <select value={style.alignment ?? 'center'} onChange={event => onUpdateStyle({ alignment: event.target.value })} className="mt-2 w-full rounded-lg bg-stone-900 p-2 text-xs text-white">
                <option value="right">راست</option><option value="center">وسط</option><option value="left">چپ</option>
              </select>
            </label>
            <label className="text-[10px] text-stone-400">ضخامت فونت
              <select value={style.fontWeight ?? 'bold'} onChange={event => onUpdateStyle({ fontWeight: event.target.value })} className="mt-2 w-full rounded-lg bg-stone-900 p-2 text-xs text-white">
                <option value="normal">معمولی</option><option value="bold">ضخیم</option><option value="900">خیلی ضخیم</option>
              </select>
            </label>
            <label className="col-span-2 flex items-center justify-between rounded-lg bg-stone-900 p-2 text-[10px] text-stone-300">فونت مورب
              <input type="checkbox" checked={Boolean(style.italic)} onChange={event => onUpdateStyle({ italic: event.target.checked })} className="accent-amber-500" />
            </label>
          </section>

          <section className="space-y-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
            <div>
              <h3 className="text-xs font-bold text-cyan-200">واترمارک متن یا استیکر</h3>
              <p className="mt-1 text-[10px] leading-5 text-stone-500">واترمارک روی پیش‌نمایش و فایل MP4 می‌آید. برای جابه‌جایی، X و Y را تنظیم کن.</p>
            </div>
            <div className="flex gap-2">
              <input value={watermarkTextDraft} onChange={event => setWatermarkTextDraft(event.target.value)} maxLength={60} aria-label="متن واترمارک" className="min-w-0 flex-1 rounded-lg border border-stone-700 bg-black/40 px-2 py-2 text-xs text-white outline-none" />
              <button type="button" onClick={() => addWatermark('text')} className="rounded-lg bg-cyan-500/15 px-3 text-xs text-cyan-100">+ متن</button>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="استیکرهای آماده">
              {['✨', '⭐', '❤️', '🔥', '🎬', '💎', '🌸', '👑'].map(sticker => <button key={sticker} type="button" title={`افزودن استیکر ${sticker}`} onClick={() => addWatermark('sticker', sticker)} className="rounded-lg border border-stone-800 bg-black/30 px-2 py-1.5 text-lg hover:border-cyan-400/50">{sticker}</button>)}
            </div>
            {(style.watermarks ?? []).map((watermark: WatermarkOverlay) => (
              <div key={watermark.id} className="space-y-2 rounded-lg border border-stone-800 bg-black/30 p-2">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs">{watermark.type === 'sticker' ? '🎟️' : 'T'}</span>
                  <input value={watermark.value} maxLength={60} onChange={event => updateWatermark(watermark.id, { value: event.target.value })} aria-label="محتوای واترمارک" className="min-w-0 flex-1 rounded bg-stone-900 px-2 py-1.5 text-xs text-white" />
                  {watermark.type === 'text' && <input type="color" value={watermark.color} onChange={event => updateWatermark(watermark.id, { color: event.target.value })} className="h-7 w-8 rounded" />}
                  <button type="button" aria-label="حذف واترمارک" onClick={() => onUpdateStyle({ watermarks: style.watermarks.filter((item: WatermarkOverlay) => item.id !== watermark.id) })} className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-300">×</button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-stone-400">
                  <label>X: {Math.round(watermark.x)}%<input type="range" min="0" max="100" value={watermark.x} onChange={event => updateWatermark(watermark.id, { x: Number(event.target.value) })} className="block w-full accent-cyan-400" /></label>
                  <label>Y: {Math.round(watermark.y)}%<input type="range" min="0" max="100" value={watermark.y} onChange={event => updateWatermark(watermark.id, { y: Number(event.target.value) })} className="block w-full accent-cyan-400" /></label>
                  <label>اندازه: {watermark.size}%<input type="range" min="1" max="12" step="0.5" value={watermark.size} onChange={event => updateWatermark(watermark.id, { size: Number(event.target.value) })} className="block w-full accent-cyan-400" /></label>
                  <label>شفافیت: {Math.round(watermark.opacity * 100)}%<input type="range" min="0.1" max="1" step="0.05" value={watermark.opacity} onChange={event => updateWatermark(watermark.id, { opacity: Number(event.target.value) })} className="block w-full accent-cyan-400" /></label>
                  <label className="col-span-2">چرخش: {watermark.rotation}°<input type="range" min="-45" max="45" value={watermark.rotation} onChange={event => updateWatermark(watermark.id, { rotation: Number(event.target.value) })} className="block w-full accent-cyan-400" /></label>
                </div>
              </div>
            ))}
          </section>

          {/* موقعیت */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold">موقعیت</h3>
            <label className="block text-[10px] text-stone-400">
              X: {x.toFixed(0)}%
              <input 
                type="range" 
                min="5" 
                max="95" 
                value={x} 
                onPointerDown={handleDragStart} 
                onChange={e => onUpdateStyle({ positionXPercent: Number(e.target.value) }, false)} 
                onPointerUp={handleDragEnd} 
                className="mt-2 w-full accent-amber-500" 
              />
            </label>
            <label className="block text-[10px] text-stone-400">
              Y: {y.toFixed(0)}%
              <input 
                type="range" 
                min="5" 
                max="95" 
                value={y} 
                onPointerDown={handleDragStart} 
                onChange={e => onUpdateStyle({ positionYPercent: Number(e.target.value) }, false)} 
                onPointerUp={handleDragEnd} 
                className="mt-2 w-full accent-amber-500" 
              />
            </label>
            <p className="text-[10px] text-stone-500">موقعیت نسبت به خود فریم ویدیو ذخیره می‌شود.</p>
          </section>

          {/* دکمه‌های toggle */}
          <section className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => onUpdateStyle({ hasActiveWordBg: !Boolean(style.hasActiveWordBg) })} 
              className={`rounded-xl p-3 text-xs transition-all ${
                style.hasActiveWordBg ? 'bg-amber-500 text-black' : 'bg-stone-900 text-stone-300'
              }`}
            >
                پس‌زمینهٔ کلمهٔ فعال {style.hasActiveWordBg ? 'روشن' : 'خاموش'}
            </button>
            <button 
              onClick={() => onUpdateStyle({ hasShadow: !Boolean(style.hasShadow) })} 
              className={`rounded-xl p-3 text-xs transition-all ${
                style.hasShadow ? 'bg-amber-500 text-black' : 'bg-stone-900 text-stone-300'
              }`}
            >
                سایه {style.hasShadow ? 'روشن' : 'خاموش'}
            </button>
          </section>
        </div>
      </section>
    </div>
  )
}
