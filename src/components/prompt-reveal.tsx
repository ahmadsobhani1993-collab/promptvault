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
  const hasLabels = /\b(?:Expression|Outfit|Action|Environment|Lighting|Art Style|Details|Shot with):/i.test(main)

  if (hasLabels) {
    const parts = main.split(/(?=\b(?:Expression|Outfit|Action|Environment|Lighting|Art Style|Details|Shot with):)/gi)
    parts.forEach((p, idx) => {
      const clean = p.trim()
      if (!clean) return

      let titleFa = 'جزئیات صحنه'
      let titleEn = 'Scene Details'
      let customizable = true
      let hintFa = 'قابل ویرایش دلخواه'
      let hintEn = 'Editable field'

      if (/^Shot with/i.test(clean) || /camera|sensor|iso|f\//i.test(clean)) {
        titleFa = 'تنظیمات دوربین و رندر'
        titleEn = 'Camera & Tech Specs'
        customizable = false
        hintFa = 'پیشنهاد برای حفظ کیفیت و زاویه ثابت بماند.'
        hintEn = 'Recommended to keep for style consistency.'
      } else if (/^Lighting:/i.test(clean) || /lighting|shadows/i.test(clean)) {
        titleFa = 'نورپردازی و فضا'
        titleEn = 'Lighting & Atmosphere'
        customizable = true
        hintFa = 'تغییر تن رنگی و نور صحنه.'
        hintEn = 'Customize tone and scene illumination.'
      } else if (/^Environment:/i.test(clean) || /background|room|studio/i.test(clean)) {
        titleFa = 'محیط و پس‌زمینه'
        titleEn = 'Environment & Scene'
        customizable = true
        hintFa = 'مکان و دکور صحنه را ادیت کنید.'
        hintEn = 'Edit backdrop or scene environment.'
      } else if (idx === 0) {
        titleFa = 'سوژه اصلی و کاراکتر'
        titleEn = 'Main Subject & Target'
        customizable = true
        hintFa = 'سوژه، محصول یا فرد اصلی پرامپت.'
        hintEn = 'Main subject, product, or character.'
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
    // تقسیم‌بندی بر اساس جملات و کاما
    const chunks = main.split(/,\s*(?![^()]*\))/).map(s => s.trim()).filter(Boolean)
    let subjectParts: string[] = []
    let lightingParts: string[] = []
    let sceneParts: string[] = []
    let cameraParts: string[] = []

    chunks.forEach((chunk) => {
      if (/(?:lighting|volumetric|neon|shadow|glow|dramatic|moody|soft light)/i.test(chunk)) {
        lightingParts.push(chunk)
      } else if (/(?:photorealistic|8k|film still|35mm|close-up|depth of field|bokeh|detailed|shot on)/i.test(chunk)) {
        cameraParts.push(chunk)
      } else if (/(?:background|projection|studio|table|countertop|floor|room|kitchen|outdoor|indoor)/i.test(chunk)) {
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
        hintFa: 'نام محصول، مشخصات چهره یا ویژگی‌های سوژه را مستقیم تغییر دهید.',
        hintEn: 'Customize subject, product name, or main model attributes.'
      })
    }

    if (sceneParts.length > 0) {
      sections.push({
        id: 'sec-scene',
        titleFa: 'محیط و المان‌های پس‌زمینه',
        titleEn: 'Environment & Background',
        text: sceneParts.join(', '),
        isCustomizable: true,
        hintFa: 'فضای بک‌گراند، دکور و افکت‌های جانبی.',
        hintEn: 'Scene surroundings, backdrop, and props.'
      })
    }

    if (lightingParts.length > 0) {
      sections.push({
        id: 'sec-lighting',
        titleFa: 'نورپردازی و اتمسفر',
        titleEn: 'Lighting & Atmosphere',
        text: lightingParts.join(', '),
        isCustomizable: true,
        hintFa: 'تن رنگی، زاویه نور و کنتراست تصویر.',
        hintEn: 'Color tone, light intensity, and contrast.'
      })
    }

    if (cameraParts.length > 0) {
      sections.push({
        id: 'sec-camera',
        titleFa: 'تنظیمات فنی و کیفیت رندر',
        titleEn: 'Camera & Quality Specs',
        text: cameraParts.join(', '),
        isCustomizable: false,
        hintFa: 'پارامترهای کیفیتی دوربین (پیشنهاد: دست نخورد).',
        hintEn: 'Technical camera and resolution parameters.'
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

  const currentMergedPrompt = useMemo(() => {
    if (viewMode === 'raw' && text) {
      return text.replace(/(?:Negative prompt:|Negative:)\s*[\s\S]*$/i, '').trim()
    }
    return editableSections.map(s => s.text).filter(Boolean).join(', ')
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
    <div className="mt-8 rounded-2xl border border-gold/40 bg-[#0d0b07] p-4 sm:p-6 shadow-2xl">
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
              className={`rounded-md px-3 py-1.5 transition ${viewMode === 'anatomy' ? 'bg-amber-500 text-black font-bold' : 'text-zinc-400 hover:text-white'}`}
            >
              {isEn ? 'Anatomy (Editable)' : 'آناتومی (ویرایش‌پذیر)'}
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`rounded-md px-3 py-1.5 transition ${viewMode === 'raw' ? 'bg-amber-500 text-black font-bold' : 'text-zinc-400 hover:text-white'}`}
            >
              {isEn ? 'Raw' : 'متن خام'}
            </button>
          </div>

          <CopyButton
            text={currentMergedPrompt}
            label={isEn ? 'Copy Clean Prompt' : 'کپی پرامپت خالص'}
            copiedLabel={isEn ? 'Copied!' : 'کپی شد!'}
          />
        </div>
      </div>

      {viewMode === 'raw' ? (
        <div className="mt-4">
          <p dir="ltr" className="text-left font-mono text-sm leading-7 text-[#e8d9ae] whitespace-pre-wrap selection:bg-amber-500 selection:text-black">
            {text}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {editableSections.map((sec, i) => (
            <div key={sec.id} className="group rounded-xl border border-white/10 bg-[#14100c] p-4 transition focus-within:border-amber-500/60 focus-within:ring-1 focus-within:ring-amber-500/30">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-200">
                    {i + 1}. {isEn ? sec.titleEn : sec.titleFa}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${
                    sec.isCustomizable
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                  }`}>
                    {sec.isCustomizable ? (isEn ? 'Editable ✏️' : 'قابل ویرایش ✏️') : (isEn ? 'Recommended Fixed 🔒' : 'پیشنهادی ثابت 🔒')}
                  </span>
                </div>
                <CopyButton
                  text={sec.text}
                  label={isEn ? 'Copy' : 'کپی'}
                  copiedLabel={isEn ? 'Copied' : 'کپی شد'}
                />
              </div>

              {/* ادیتور باز و جادار با ارتفاع کافی */}
              <div className="mt-2.5">
                <textarea
                  rows={3}
                  dir="ltr"
                  value={sec.text}
                  onChange={(e) => handleSectionTextChange(sec.id, e.target.value)}
                  className="w-full min-h-[75px] rounded-lg border border-white/10 bg-black/50 p-3 font-mono text-xs leading-6 text-zinc-100 transition focus:border-amber-500/60 focus:bg-black/80 focus:outline-none"
                  placeholder={isEn ? 'Type to customize this section...' : 'این بخش را مطابق نیاز خود ویرایش کنید...'}
                />
              </div>

              <p className="mt-1.5 text-[11px] text-zinc-500">
                💡 {isEn ? sec.hintEn : sec.hintFa}
              </p>
            </div>
          ))}

          {parsed?.negative && (
            <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-400">
                  🚫 {isEn ? 'Negative Prompt' : 'پرامپت منفی (Negative)'}
                </span>
                <CopyButton
                  text={parsed.negative}
                  label={isEn ? 'Copy' : 'کپی'}
                  copiedLabel={isEn ? 'Copied' : 'کپی شد'}
                />
              </div>
              <p dir="ltr" className="mt-2 text-left font-mono text-xs leading-6 text-red-200/90">
                {parsed.negative}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/5 pt-4">
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
