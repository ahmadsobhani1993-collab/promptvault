'use client'
import { useRef } from 'react'
import { PRESETS, FONTS } from './constants'
import { Preset, Snapshot } from './types'
import { ensureFontLoaded, listUploadedFonts, saveUploadedFont, type UploadedSubtitleFont } from '@/lib/studio/font-loader'
import { deleteSubtitleTemplate, getSavedSubtitleTemplates, saveSubtitleTemplate, type SavedSubtitleTemplate, type WatermarkOverlay } from '@/lib/studio/unified-style'
import { useEffect, useState } from 'react'
import { useLocale } from '@/lib/use-locale'
import { L } from '@/lib/l'

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
  const locale = useLocale()
  const isEn = locale === 'en'
  const t = (fa: string, en: string) => L(locale, fa, en)
  const x = Number(style.positionXPercent ?? style.x ?? 50)
  const y = Number(style.positionYPercent ?? style.y ?? 82)
  const beforeStyleDragRef = useRef<Snapshot | null>(null)
  const [fontsReady, setFontsReady] = useState(false)
  const [customTemplates, setCustomTemplates] = useState<SavedSubtitleTemplate[]>([])
  const [templateName, setTemplateName] = useState(isEn ? 'My template' : 'قالب من')
  const [uploadedFonts, setUploadedFonts] = useState<UploadedSubtitleFont[]>([])
  const [fontError, setFontError] = useState('')
  const [watermarkTextDraft, setWatermarkTextDraft] = useState(isEn ? 'Your page name' : 'نام پیج شما')

  const refreshFonts = async () => {
    try { setUploadedFonts(await listUploadedFonts()) } catch { setFontError(t('خواندن فونت‌های ذخیره‌شده ناموفق بود.', 'Could not load saved fonts.')) }
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
      setFontError(error?.message || t('بارگذاری فونت انجام نشد.', 'Font upload failed.'))
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
      setFontError(t('ذخیرهٔ قالب ممکن نشد؛ فضای ذخیره‌سازی مرورگر را بررسی کنید.', 'Could not save the template. Check your browser storage.'))
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
        dir={isEn ? 'ltr' : 'rtl'}
        className={`absolute inset-y-0 ${isEn ? 'right-0 border-l' : 'left-0 border-r'} w-full max-w-[430px] overflow-y-auto border-stone-800 bg-[#12100d] shadow-2xl`}
      >
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-800 bg-[#12100d] p-4">
          <div>
            <h2 className="text-sm font-black">{t('استایل زیرنویس', 'Subtitle style')}</h2>
            <p className="text-[10px] text-stone-500">{t('قالب، فونت و تنظیمات در یک‌جا', 'Templates, fonts, and settings in one place')}</p>
          </div>
          <button onClick={onClose} className="rounded-lg bg-stone-800 px-3 py-1.5">✕</button>
        </div>
        
        <div className="space-y-6 p-4">
          {/* قالب‌ها */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold">{t('قالب‌ها', 'Presets')}</h3>
              <span className="text-[10px] text-stone-500">{PRESETS.length} {t('قالب', 'presets')}</span>
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
                      {t('این فونت چه حالی به نوشته می‌دهد؟', 'See how this font looks')}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold">{isEn ? ({ viral: '🔥 Viral', minimal: 'Minimal', podcast: '🎙 Podcast', cinema: '🎬 Cinematic', news: '📰 News', neon: '⚡ Neon', luxury: '💎 Luxury', bold: '💥 Bold', pastel: '🌸 Pastel', tech: '🤖 Tech' } as Record<string, string>)[p.id] : p.name}</div>
                  <div className="mt-1 text-[9px] text-stone-500">{p.fontId}{!fontsReady ? ` · ${t('در حال بارگذاری فونت', 'Loading font')}` : ''}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-3">
            <div>
              <h3 className="text-xs font-bold text-purple-200">{t('استودیوی ساخت قالب', 'Template studio')}</h3>
              <p className="mt-1 text-[10px] leading-5 text-stone-500">{t('تنظیمات فعلی را با نام دلخواه ذخیره کن؛ قالب روی تمام باکس‌های زیرنویس اعمال می‌شود.', 'Save the current settings as a named template and apply it to all subtitle boxes.')}</p>
            </div>
            <div className="flex gap-2">
              <input value={templateName} onChange={event => setTemplateName(event.target.value)} maxLength={32} aria-label={t('نام قالب شخصی', 'Custom template name')} className="min-w-0 flex-1 rounded-lg border border-stone-700 bg-black/40 px-2 py-2 text-xs text-white outline-none focus:border-purple-400" />
              <button type="button" onClick={handleSaveTemplate} className="shrink-0 rounded-lg bg-purple-500/20 px-3 py-2 text-xs font-bold text-purple-200">{t('ذخیره قالب من', 'Save my template')}</button>
            </div>
            {customTemplates.length > 0 && <div className="space-y-1.5">
              {customTemplates.map(template => (
                <div key={template.id} className="flex items-center gap-2 rounded-lg border border-stone-800 bg-black/30 p-2">
                  <button type="button" onClick={() => { onUpdateStyle(template.style); if (template.style.fontFamily) onApplyFont(template.style.fontFamily) }} className="min-w-0 flex-1 truncate text-right text-xs text-white">{template.name}</button>
                  <button type="button" aria-label={`${t('حذف', 'Delete')} ${template.name}`} onClick={() => setCustomTemplates(deleteSubtitleTemplate(template.id))} className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-300">{t('حذف', 'Delete')}</button>
                </div>
              ))}
            </div>}
          </section>

          {/* فونت‌ها */}
          <section>
            <h3 className="mb-2 text-xs font-bold">{t('فونت‌ها', 'Fonts')}</h3>
            <div className="grid grid-cols-2 gap-2">
              {[...FONTS, ...uploadedFonts.map(font => ({ id: font.family, label: font.name, category: t('آپلودشده', 'Uploaded') }))].map(f => (
                <button 
                  key={f.id} 
                  onClick={() => onApplyFont(f.id)} 
                  className={`rounded-xl border p-3 text-right transition-all ${
                    fontId === f.id ? 'border-amber-400 bg-amber-500/10' : 'border-stone-800 bg-stone-900/60'
                  }`}
                >
                  <div dir={isEn ? 'ltr' : 'rtl'} style={{ fontFamily: `"${f.id}", sans-serif`, fontSize: 18, fontWeight: 700 }}>
                    <span style={{ color: style.textColor ?? '#fff' }}>{t('یک جملهٔ نمونه با ', 'A sample sentence in ')}</span><span style={{ color: style.activeWordColor ?? '#f59e0b' }}>{t('این فونت', 'this font')}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-stone-500">{isEn ? ({ 'وزیرمتن': 'Vazirmatn', 'استعداد': 'Estedad', 'ریدکس پرو': 'Readex Pro', 'پلکس': 'IBM Plex Sans Arabic', 'کوفی': 'Kufi', 'لاله‌زار': 'Lalezar', 'امیری': 'Amiri', 'نستعلیق': 'Nastaliq' } as Record<string, string>)[f.label] ?? f.label : f.label} · {isEn ? ({ 'مدرن': 'Modern', 'دیجیتال': 'Digital', 'تمیز': 'Clean', 'نمایشی': 'Display', 'ادبی': 'Literary' } as Record<string, string>)[f.category] ?? f.category : f.category}</div>
                </button>
              ))}
            </div>
            <label className="block cursor-pointer rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-center text-xs text-amber-200 transition hover:bg-amber-500/10">
              {t('⬆ بارگذاری فونت خودم', '⬆ Upload a custom font')} (WOFF / WOFF2 / TTF / OTF)
              <input type="file" accept=".woff,.woff2,.ttf,.otf,font/woff,font/woff2,font/ttf,font/otf" onChange={handleFontUpload} className="hidden" />
            </label>
            {fontError && <p role="alert" className="text-[10px] text-red-300">{fontError}</p>}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-bold">{t('انیمیشن ورود زیرنویس', 'Subtitle entrance animation')}</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'none', label: t('بدون انیمیشن', 'None') },
                { id: 'pop', label: '💥 Pop' },
                { id: 'zoomIn', label: '🔎 Zoom In' },
                { id: 'zoomOut', label: '↘ Zoom Out' },
              ].map(animation => (
                <button key={animation.id} onClick={() => onUpdateStyle({ subtitleAnimation: animation.id })} className={`rounded-lg border px-3 py-2 text-xs ${style.subtitleAnimation === animation.id ? 'border-amber-400 bg-amber-500/15 text-amber-300' : 'border-stone-800 bg-stone-900 text-stone-300'}`}>
                  {animation.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-stone-500">{t('افکت هنگام شروع هر باکس پخش می‌شود و در خروجی ویدیو هم اعمال خواهد شد.', 'The effect plays at the start of each caption and is included in the exported video.')}</p>
          </section>

          {/* اندازه و رنگ */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold">{t('اندازه و رنگ', 'Size and color')}</h3>
            <label className="block text-[10px] text-stone-400">
              {t('اندازه:', 'Size:')} {Number(style.fontSizePercent ?? 4.8).toFixed(1)}% {t('از عرض ویدیو', 'of video width')}
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
                {t('رنگ متن', 'Text color')}
                <input 
                  type="color" 
                  value={style.textColor ?? '#ffffff'} 
                  onChange={e => onUpdateStyle({ textColor: e.target.value })} 
                  className="mt-2 h-8 w-full" 
                />
              </label>
              <label className="rounded-lg bg-stone-900 p-2 text-[10px]">
                {t('رنگ کلمه فعال', 'Active word color')}
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
            <h3 className="text-xs font-bold">{t('باکس و دورنویس', 'Box and outline')}</h3>
            <label className="flex items-center justify-between text-[10px] text-stone-300">
              {t('پس‌زمینهٔ باکس', 'Box background')}
              <input type="checkbox" checked={Boolean(style.hasBg)} onChange={event => onUpdateStyle({ hasBg: event.target.checked })} className="accent-amber-500" />
            </label>
            <label className="block text-[10px] text-stone-400">
              {t('شفافیت باکس:', 'Box opacity:')} {Math.round(Number(style.bgOpacity ?? 0.75) * 100)}%
              <input type="range" min="0" max="1" step="0.01" value={Number(style.bgOpacity ?? 0.75)} onChange={event => onUpdateStyle({ bgOpacity: Number(event.target.value) })} className="mt-2 w-full accent-amber-500" />
            </label>
            <label className="block rounded-lg bg-stone-900 p-2 text-[10px] text-stone-300">{t('رنگ باکس', 'Box color')}
              <input type="color" value={toHexColor(String(style.bgColor ?? 'rgba(0,0,0,0.75)'))} onChange={event => { const hex = event.target.value; const red = parseInt(hex.slice(1,3),16); const green = parseInt(hex.slice(3,5),16); const blue = parseInt(hex.slice(5,7),16); onUpdateStyle({ bgColor: `rgba(${red},${green},${blue},${Number(style.bgOpacity ?? 0.75)})` }) }} className="mt-2 h-8 w-full" />
            </label>
            <label className="block text-[10px] text-stone-400">
              {t('گردی گوشه‌ها:', 'Corner radius:')} {Number(style.bgRadius ?? 14)}px
              <input type="range" min="0" max="48" value={Number(style.bgRadius ?? 14)} onChange={event => onUpdateStyle({ bgRadius: Number(event.target.value) })} className="mt-2 w-full accent-amber-500" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="rounded-lg bg-stone-900 p-2 text-[10px]">{t('رنگ مرز باکس', 'Box border color')}
                <input type="color" value={style.bgBorderColor ?? '#ffffff'} onChange={event => onUpdateStyle({ bgBorderColor: event.target.value })} className="mt-2 h-8 w-full" />
              </label>
              <label className="rounded-lg bg-stone-900 p-2 text-[10px]">{t('ضخامت مرز:', 'Border width:')} {Number(style.bgBorderWidth ?? 0)}px
                <input type="range" min="0" max="12" step="1" value={Number(style.bgBorderWidth ?? 0)} onChange={event => onUpdateStyle({ bgBorderWidth: Number(event.target.value) })} className="mt-2 w-full accent-amber-500" />
              </label>
              <label className="rounded-lg bg-stone-900 p-2 text-[10px]">{t('رنگ دور نوشته', 'Text outline color')}
                <input type="color" value={style.textStrokeColor ?? '#000000'} onChange={event => onUpdateStyle({ textStrokeColor: event.target.value })} className="mt-2 h-8 w-full" />
              </label>
              <label className="rounded-lg bg-stone-900 p-2 text-[10px]">{t('ضخامت دور:', 'Outline width:')} {Number(style.textStrokeWidth ?? 2)}px
                <input type="range" min="0" max="12" step="0.5" value={Number(style.textStrokeWidth ?? 2)} onChange={event => onUpdateStyle({ textStrokeWidth: Number(event.target.value), hasTextStroke: Number(event.target.value) > 0 })} className="mt-2 w-full accent-amber-500" />
              </label>
            </div>
            <label className="flex items-center justify-between text-[10px] text-stone-300">
              {t('دور نوشته روشن', 'Text outline enabled')}
              <input type="checkbox" checked={Boolean(style.hasTextStroke)} onChange={event => onUpdateStyle({ hasTextStroke: event.target.checked })} className="accent-amber-500" />
            </label>
          </section>

          <section className="grid grid-cols-2 gap-2 rounded-xl border border-stone-800 bg-stone-900/40 p-3">
            <label className="text-[10px] text-stone-400">{t('چینش متن', 'Text alignment')}
              <select value={style.alignment ?? 'center'} onChange={event => onUpdateStyle({ alignment: event.target.value })} className="mt-2 w-full rounded-lg bg-stone-900 p-2 text-xs text-white">
                <option value="right">{t('راست', 'Right')}</option><option value="center">{t('وسط', 'Center')}</option><option value="left">{t('چپ', 'Left')}</option>
              </select>
            </label>
            <label className="text-[10px] text-stone-400">{t('ضخامت فونت', 'Font weight')}
              <select value={style.fontWeight ?? 'bold'} onChange={event => onUpdateStyle({ fontWeight: event.target.value })} className="mt-2 w-full rounded-lg bg-stone-900 p-2 text-xs text-white">
                <option value="normal">{t('معمولی', 'Regular')}</option><option value="bold">{t('ضخیم', 'Bold')}</option><option value="900">{t('خیلی ضخیم', 'Extra bold')}</option>
              </select>
            </label>
            <label className="col-span-2 flex items-center justify-between rounded-lg bg-stone-900 p-2 text-[10px] text-stone-300">{t('فونت مورب', 'Italic font')}
              <input type="checkbox" checked={Boolean(style.italic)} onChange={event => onUpdateStyle({ italic: event.target.checked })} className="accent-amber-500" />
            </label>
          </section>

          <section className="space-y-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
            <div>
              <h3 className="text-xs font-bold text-cyan-200">{t('واترمارک متن یا استیکر', 'Text or sticker watermark')}</h3>
              <p className="mt-1 text-[10px] leading-5 text-stone-500">{t('واترمارک روی پیش‌نمایش و فایل MP4 می‌آید. برای جابه‌جایی، X و Y را تنظیم کن.', 'The watermark appears in the preview and exported MP4. Adjust X and Y to reposition it.')}</p>
            </div>
            <div className="flex gap-2">
              <input value={watermarkTextDraft} onChange={event => setWatermarkTextDraft(event.target.value)} maxLength={60} aria-label={t('متن واترمارک', 'Watermark text')} className="min-w-0 flex-1 rounded-lg border border-stone-700 bg-black/40 px-2 py-2 text-xs text-white outline-none" />
              <button type="button" onClick={() => addWatermark('text')} className="rounded-lg bg-cyan-500/15 px-3 text-xs text-cyan-100">+ {t('متن', 'Text')}</button>
            </div>
            <div className="flex flex-wrap gap-2" aria-label={t('استیکرهای آماده', 'Available stickers')}>
              {['✨', '⭐', '❤️', '🔥', '🎬', '💎', '🌸', '👑'].map(sticker => <button key={sticker} type="button" title={`${t('افزودن استیکر', 'Add sticker')} ${sticker}`} onClick={() => addWatermark('sticker', sticker)} className="rounded-lg border border-stone-800 bg-black/30 px-2 py-1.5 text-lg hover:border-cyan-400/50">{sticker}</button>)}
            </div>
            {(style.watermarks ?? []).map((watermark: WatermarkOverlay) => (
              <div key={watermark.id} className="space-y-2 rounded-lg border border-stone-800 bg-black/30 p-2">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs">{watermark.type === 'sticker' ? '🎟️' : 'T'}</span>
                  <input value={watermark.value} maxLength={60} onChange={event => updateWatermark(watermark.id, { value: event.target.value })} aria-label={t('محتوای واترمارک', 'Watermark content')} className="min-w-0 flex-1 rounded bg-stone-900 px-2 py-1.5 text-xs text-white" />
                  {watermark.type === 'text' && <input type="color" value={watermark.color} onChange={event => updateWatermark(watermark.id, { color: event.target.value })} className="h-7 w-8 rounded" />}
                  <button type="button" aria-label={t('حذف واترمارک', 'Delete watermark')} onClick={() => onUpdateStyle({ watermarks: style.watermarks.filter((item: WatermarkOverlay) => item.id !== watermark.id) })} className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-300">×</button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-stone-400">
                  <label>X: {Math.round(watermark.x)}%<input type="range" min="0" max="100" value={watermark.x} onChange={event => updateWatermark(watermark.id, { x: Number(event.target.value) })} className="block w-full accent-cyan-400" /></label>
                  <label>Y: {Math.round(watermark.y)}%<input type="range" min="0" max="100" value={watermark.y} onChange={event => updateWatermark(watermark.id, { y: Number(event.target.value) })} className="block w-full accent-cyan-400" /></label>
                  <label>{t('اندازه:', 'Size:')} {watermark.size}%<input type="range" min="1" max="12" step="0.5" value={watermark.size} onChange={event => updateWatermark(watermark.id, { size: Number(event.target.value) })} className="block w-full accent-cyan-400" /></label>
                  <label>{t('شفافیت:', 'Opacity:')} {Math.round(watermark.opacity * 100)}%<input type="range" min="0.1" max="1" step="0.05" value={watermark.opacity} onChange={event => updateWatermark(watermark.id, { opacity: Number(event.target.value) })} className="block w-full accent-cyan-400" /></label>
                  <label className="col-span-2">{t('چرخش:', 'Rotation:')} {watermark.rotation}°<input type="range" min="-45" max="45" value={watermark.rotation} onChange={event => updateWatermark(watermark.id, { rotation: Number(event.target.value) })} className="block w-full accent-cyan-400" /></label>
                </div>
              </div>
            ))}
          </section>

          {/* موقعیت */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold">{t('موقعیت', 'Position')}</h3>
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
            <p className="text-[10px] text-stone-500">{t('موقعیت نسبت به خود فریم ویدیو ذخیره می‌شود.', 'Position is stored relative to the video frame.')}</p>
          </section>

          {/* دکمه‌های toggle */}
          <section className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => onUpdateStyle({ hasActiveWordBg: !Boolean(style.hasActiveWordBg) })} 
              className={`rounded-xl p-3 text-xs transition-all ${
                style.hasActiveWordBg ? 'bg-amber-500 text-black' : 'bg-stone-900 text-stone-300'
              }`}
            >
                {t('پس‌زمینهٔ کلمهٔ فعال', 'Active word background')} {style.hasActiveWordBg ? t('روشن', 'On') : t('خاموش', 'Off')}
            </button>
            <button 
              onClick={() => onUpdateStyle({ hasShadow: !Boolean(style.hasShadow) })} 
              className={`rounded-xl p-3 text-xs transition-all ${
                style.hasShadow ? 'bg-amber-500 text-black' : 'bg-stone-900 text-stone-300'
              }`}
            >
                {t('سایه', 'Shadow')} {style.hasShadow ? t('روشن', 'On') : t('خاموش', 'Off')}
            </button>
          </section>
        </div>
      </section>
    </div>
  )
}
