'use client'

import { useState, useMemo } from 'react'
import CopyButton from '@/components/copy-button'
import InstagramCaptionModal from '@/components/InstagramCaptionModal'

interface Section {
  id: string
  titleFa: string
  titleEn: string
  text: string
  isCustomizable: boolean
  hintFa: string
  hintEn: string
}

function parsePromptAnatomy(raw: string) {
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
  const parts = main.split(/(?=\b(?:Expression:|Outfit:|Action:|Environment:|Lighting:|Art Style:|Details:|Shot with)\b)/g)

  if (parts.length > 1) {
    parts.forEach((p, idx) => {
      const clean = p.trim()
      if (!clean) return

      let titleFa = 'جزئیات'
      let titleEn = 'Details'
      let customizable = true
      let hintFa = 'قابل تنظیم و ویرایش'
      let hintEn = 'Can be adjusted'

      if (/^Shot with/i.test(clean) || /camera|sensor|iso|f\//i.test(clean)) {
        titleFa = 'دوربین و تنظیمات فنی'
        titleEn = 'Camera & Lens'
        customizable = false
        hintFa = 'پیشنهاد می‌شود برای حفظ بافت طبیعی و سینمایی ثابت بماند.'
        hintEn = 'Recommended to keep unchanged for realistic look.'
      } else if (/^Lighting:/i.test(clean) || /lighting|shadows/i.test(clean)) {
        titleFa = 'نورپردازی و اتمسفر'
        titleEn = 'Lighting & Atmosphere'
        customizable = false
        hintFa = 'ثابت برای ایجاد همان تن رنگی و گرمای محیط.'
        hintEn = 'Fixed for matching color grade and tone.'
      } else if (/^Environment:/i.test(clean) || /studio|room|forest/i.test(clean)) {
        titleFa = 'محیط و لوکیشن'
        titleEn = 'Environment & Scene'
        customizable = true
        hintFa = 'پس‌زمینه و دکور صحنه را تغییر دهید.'
        hintEn = 'Customize background and scene elements.'
      } else if (/^Outfit:|^Expression:/i.test(clean)) {
        titleFa = 'پوشش و حس چهره'
        titleEn = 'Outfit & Expression'
        customizable = true
        hintFa = 'لباس و حس صورت کاراکتر.'
        hintEn = 'Modify clothing and mood.'
      } else if (idx === 0) {
        titleFa = 'سوژه اصلی و مشخصات رفرنس'
        titleEn = 'Main Subject & Identity'
        customizable = true
        hintFa = 'سوژه یا مشخصات فرد را با چهره موردنظر خود تغییر دهید.'
        hintEn = 'Swap with your reference or custom character.'
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
    sections.push({
      id: 'sec-main',
      titleFa: 'پرامپت اصلی',
      titleEn: 'Main Prompt',
      text: main,
      isCustomizable: true,
      hintFa: 'متن پرامپت آماده استفاده',
      hintEn: 'Ready-to-use prompt text'
    })
  }

  return { sections, negative, ar, rawPrompt: raw }
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
    return text ? parsePromptAnatomy(text) : null
  }, [text])

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

  const cleanFullPrompt = text
    .replace(/(?:Negative prompt:|Negative:)\s*[\s\S]*$/i, '')
    .trim()

  return (
    <div className="mt-8 rounded-2xl border border-gold/40 bg-[#0d0b07] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gold-bright tracking-wide">
            {isEn ? '⚡ PROMPT ANATOMY' : '⚡ آناتومی ساختار پرامپت'}
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
              {isEn ? 'Anatomy' : 'آناتومی'}
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`rounded-md px-2.5 py-1 transition ${viewMode === 'raw' ? 'bg-amber-500 text-black font-bold' : 'text-zinc-400 hover:text-white'}`}
            >
              {isEn ? 'Raw' : 'متن خام'}
            </button>
          </div>

          <CopyButton text={cleanFullPrompt} label={isEn ? 'Copy Clean Prompt' : 'کپی پرامپت خالص'} copiedLabel={copiedLabel} />
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
          {parsed?.sections.map((sec, i) => (
            <div key={sec.id} className="group rounded-xl border border-white/5 bg-[#120f0c] p-3.5 transition hover:border-gold/30">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-200/90">
                    {i + 1}. {isEn ? sec.titleEn : sec.titleFa}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    sec.isCustomizable
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                  }`}>
                    {sec.isCustomizable ? (isEn ? 'Customizable ✏️' : 'قابل تغییر ✏️') : (isEn ? 'Fixed 🔒' : 'ثابت 🔒')}
                  </span>
                </div>
                <CopyButton text={sec.text} label={isEn ? 'Copy' : 'کپی'} copiedLabel={copiedLabel} />
              </div>

              <p dir="ltr" className="mt-2 text-left font-mono text-xs leading-6 text-zinc-300">
                {sec.text}
              </p>

              <p className="mt-2 text-[11px] text-zinc-500">
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

      {/* بخش ابزار هوش مصنوعی تولید کپشن اینستاگرام */}
      <InstagramCaptionModal sourceText={cleanFullPrompt} locale={locale} />

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
