'use client'

import { useState, useMemo, useEffect } from 'react'
import CopyButton from '@/components/copy-button'

interface Section {
  id: string
  titleFa: string
  titleEn: string
  text: string
  isCustomizable: boolean
  hintFa: string
  hintEn: string
}

function parseSmartAnatomy(raw: string): { sections: Section[]; negative: string; ar: string } {
  let main = raw
  let negative = ''
  let ar = ''

  const arMatch = raw.match(/--(?:ar|aspect)\s+([0-9:]+)/i) || raw.match(/(?:Vertical portrait|portrait|landscape|ratio)\s+([0-9:]+)/i)
  if (arMatch) {
    ar = arMatch[1]
  }

  const negMatch = raw.match(/(?:Negative prompt:|Negative:)\s*([\s\S]*?)(?=(?:\n\n|$))/i)
  if (negMatch) {
    negative = negMatch[1].trim()
    main = raw.replace(negMatch[0], '').trim()
  }

  const sections: Section[] = []

  // بررسی الگوهای کلیدی
  const hasLabels = /\b(?:Expression|Outfit|Action|Environment|Lighting|Art Style|Details|Shot with):/i.test(main)

  if (hasLabels) {
    const parts = main.split(/(?=\b(?:Expression|Outfit|Action|Environment|Lighting|Art Style|Details|Shot with):)/gi)
    parts.forEach((p, idx) => {
      const clean = p.trim()
      if (!clean) return

      let titleFa = 'جزئیات'
      let titleEn = 'Details'
      let customizable = true
      let hintFa = 'قابل ویرایش دلخواه'
      let hintEn = 'Can be edited'

      if (/^Shot with/i.test(clean) || /camera|sensor|iso|f\//i.test(clean)) {
        titleFa = 'تنظیمات دوربین و رندر'
        titleEn = 'Camera & Render Specs'
        customizable = false
        hintFa = 'پیشنهاد برای حفظ استایل و کیفیت دست نخورد.'
        hintEn = 'Keep for photorealistic rendering.'
      } else if (/^Lighting:/i.test(clean) || /lighting|shadows/i.test(clean)) {
        titleFa = 'نورپردازی و اتمسفر'
        titleEn = 'Lighting & Atmosphere'
        customizable = true
        hintFa = 'تغییر نور، شدت سایه‌ها یا زاویه تابش.'
        hintEn = 'Adjust lighting and shadows.'
      } else if (/^Environment:/i.test(clean) || /background|room|studio/i.test(clean)) {
        titleFa = 'محیط و پس‌زمینه'
        titleEn = 'Environment & Scene'
        customizable = true
        hintFa = 'تغییر مکان صحنه یا پس‌زمینه.'
        hintEn = 'Change background setting.'
      } else if (idx === 0) {
        titleFa = 'سوژه و پرتره اصلی'
        titleEn = 'Main Subject'
        customizable = true
        hintFa = 'مشخصات چهره، زن/مرد یا سن سوژه را تغییر دهید.'
        hintEn = 'Swap or customize character attributes.'
      }

      sections.push({
        id: `sec-${idx}`,
        titleFa,
        titleEn,
        text: clean.replace(/^[A-Za-z\s]+:\s*/, '').trim() || clean,
        isCustomizable: customizable,
        hintFa,
        hintEn
      })
    })
  } else {
    // تفکیک معنایی پرامپت‌های پیوسته بر اساس کاما و واژگان کلیدی
    const chunks = main.split(',').map(s => s.trim()).filter(Boolean)
    
    let subjectParts: string[] = []
    let lightingParts: string[] = []
    let sceneParts: string[] = []
    let cameraParts: string[] = []

    chunks.forEach((chunk) => {
      if (/(?:lighting|volumetric|neon|shadow|glow|dramatic|dark moody)/i.test(chunk)) {
        lightingParts.push(chunk)
      } else if (/(?:photorealistic|8k|film still|35mm|close-up|depth of field|bokeh|ultra-detailed|unreal engine)/i.test(chunk)) {
        cameraParts.push(chunk)
      } else if (/(?:background|projection|equations|futuristic|holographic|overlay|setting|room|cyberpunk)/i.test(chunk)) {
        sceneParts.push(chunk)
      } else {
        subjectParts.push(chunk)
      }
    })

    if (subjectParts.length > 0) {
      sections.push({
        id: 'sec-subject',
        titleFa: 'سوژه اصلی و کاراکتر',
        titleEn: 'Main Subject & Features',
        text: subjectParts.join(', '),
        isCustomizable: true,
        hintFa: 'چهره، لباس و مشخصات فرد را مستقیماً ادیت کنید.',
        hintEn: 'Edit subject appearance directly.'
      })
    }

    if (sceneParts.length > 0) {
      sections.push({
        id: 'sec-scene',
        titleFa: 'المان‌ها و پس‌زمینه',
        titleEn: 'Environment & Elements',
        text: sceneParts.join(', '),
        isCustomizable: true,
        hintFa: 'افکت‌ها، معادلات یا فضای پس‌زمینه صحنه.',
        hintEn: 'Elements, overlays, and backdrop.'
      })
    }

    if (lightingParts.length > 0) {
      sections.push({
        id: 'sec-lighting',
        titleFa: 'نورپردازی و فضا',
        titleEn: 'Lighting & Atmosphere',
        text: lightingParts.join(', '),
        isCustomizable: true,
        hintFa: 'تن رنگی و سبک نور صحنه.',
        hintEn: 'Lighting style and mood.'
      })
    }

    if (cameraParts.length > 0) {
      sections.push({
        id: 'sec-camera',
        titleFa: 'تنظیمات کیفیت و رندر',
        titleEn: 'Camera & Quality Specs',
        text: cameraParts.join(', '),
        isCustomizable: false,
        hintFa: 'کلیدواژه‌های کیفیت که بهتر است ثابت بمانند.',
        hintEn: 'Rendering parameters and camera lens.'
      })
    }
  }

  return { sections, negative, ar }
}

export default function PromptReveal({
  slug,
  revealLabel,
  copyLabel,
  copiedLabel,
  hint,
  locale = 'fa',
}: {
  slug: string
  revealLabel: string
  copyLabel: string
  copiedLabel: string
  hint: string
  locale?: 'fa' | 'en'
}) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'anatomy' | 'raw'>('anatomy')
  const [editableSections, setEditableSections] = useState<Section[]>([])

  const isEn = locale === 'en'

  const reveal = async () => {
    if (text || loading) return
    setLoading(true)
    const res = await fetch('/api/prompt-content?slug=' + encodeURIComponent(slug))
    if (res.ok) {
      const j = await res.json()
      setText(j.prompt)
    }
    setLoading(false)
  }

  const parsed = useMemo(() => {
    return text ? parseSmartAnatomy(text) : null
  }, [text])

  useEffect(() => {
    if (parsed?.sections) {
      setEditableSections(parsed.sections)
    }
  }, [parsed])

  const handleSectionTextChange = (id: string, newText: string) => {
    setEditableSections(prev =>
      prev.map(sec => (sec.id === id ? { ...sec, text: newText } : sec))
    )
  }

  // پرامپت نهایی ساخته‌شده از روی ویرایش‌های کاربر در کلاینت
  const currentMergedPrompt = useMemo(() => {
    if (viewMode === 'raw' && text) {
      return text.replace(/(?:Negative prompt:|Negative:)\s*[\s\S]*$/i, '').trim()
    }
    return editableSections.map(s => s.text).join(', ')
  }, [editableSections, viewMode, text])

  if (!text) {
    return (
      <div className="mt-8 rounded-2xl border border-gold/40 bg-[#0d0b07] p-6 text-center">
        <div className="mx-auto h-20 max-w-md space-y-2 opacity-60" aria-hidden>
          <div className="h-3 rounded bg-[#241b0d]" />
          <div className="h-3 w-4/5 rounded bg-[#241b0d]" />
          <div className="h-3 w-3/5 rounded bg-[#241b0d]" />
        </div>
        <button type="button" onClick={reveal} className="btn-primary mt-4">
          {loading ? '...' : revealLabel}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-8 rounded-2xl border border-gold/40 bg-[#0d0b07] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gold-bright tracking-wide">
            {isEn ? '⚡ PROMPT ANATOMY & EDITOR' : '⚡ آناتومی و ادیتور پرامپت'}
          </span>
          {parsed?.ar && (
            <span className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 font-mono text-[11px] text-amber-400">
              AR {parsed.ar}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-black/60 p-0.5 border border-white/10 text-xs">
            <button
              onClick={() => setViewMode('anatomy')}
              className={`rounded-md px-2.5 py-1 transition ${viewMode === 'anatomy' ? 'bg-amber-500 text-black font-bold' : 'text-zinc-400 hover:text-white'}`}
            >
              {isEn ? 'Anatomy (Editable)' : 'آناتومی (قابل ویرایش)'}
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`rounded-md px-2.5 py-1 transition ${viewMode === 'raw' ? 'bg-amber-500 text-black font-bold' : 'text-zinc-400 hover:text-white'}`}
            >
              {isEn ? 'Raw' : 'متن خام'}
            </button>
          </div>

          <CopyButton text={currentMergedPrompt} label={isEn ? 'Copy Clean Prompt' : 'کپی پرامپت خالص'} copiedLabel={copiedLabel} />
        </div>
      </div>

      {viewMode === 'raw' ? (
        <div className="mt-4">
          <p dir="ltr" className="text-left font-mono text-sm leading-7 text-[#e8d9ae] whitespace-pre-wrap selection:bg-amber-500 selection:text-black">
            {text}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {editableSections.map((sec, i) => (
            <div key={sec.id} className="group rounded-xl border border-white/10 bg-[#120f0c] p-3.5 transition focus-within:border-amber-500/50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-200/90">
                    {i + 1}. {isEn ? sec.titleEn : sec.titleFa}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${
                    sec.isCustomizable
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                  }`}>
                    {sec.isCustomizable ? (isEn ? 'Editable ✏️' : 'قابل ویرایش ✏️') : (isEn ? 'Fixed 🔒' : 'پیشنهادی ثابت 🔒')}
                  </span>
                </div>
                <CopyButton text={sec.text} label={isEn ? 'Copy' : 'کپی'} copiedLabel={copiedLabel} />
              </div>

              {/* اینپوت ویرایش زنده متن در مرورگر کاربر */}
              <div className="mt-2">
                <textarea
                  rows={2}
                  dir="ltr"
                  value={sec.text}
                  onChange={(e) => handleSectionTextChange(sec.id, e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-xs leading-5 text-zinc-200 focus:border-amber-500/60 focus:bg-black/70 focus:outline-none"
                  placeholder="Type to customize this section..."
                />
              </div>

              <p className="mt-1 text-[11px] text-zinc-500">
                💡 {isEn ? sec.hintEn : sec.hintFa}
              </p>
            </div>
          ))}

          {parsed?.negative && (
            <div className="rounded-xl border border-red-500/20 bg-red-950/10 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-400">
                  🚫 {isEn ? 'Negative Prompt' : 'پرامپت منفی (Negative)'}
                </span>
                <CopyButton text={parsed.negative} label={isEn ? 'Copy' : 'کپی'} copiedLabel={copiedLabel} />
              </div>
              <p dir="ltr" className="mt-2 text-left font-mono text-xs leading-6 text-red-200/80">
                {parsed.negative}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/5 pt-4">
        <span className="text-[10px] text-ink-faint">
          {isEn ? 'Ready to use? Try on:' : 'کپی شد؟ مستقیم امتحانش کن:'}
        </span>
        <a className="badge hover:border-gold/60 hover:text-gold-bright" target="_blank" rel="noreferrer" href="https://chat.openai.com">ChatGPT</a>
        <a className="badge hover:border-gold/60 hover:text-gold-bright" target="_blank" rel="noreferrer" href="https://www.midjourney.com">Midjourney</a>
        <a className="badge hover:border-gold/60 hover:text-gold-bright" target="_blank" rel="noreferrer" href="https://gemini.google.com">Gemini</a>
      </div>
    </div>
  )
}
