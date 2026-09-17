'use client'

import { useState } from 'react'
import CopyButton from '@/components/copy-button'

interface Props {
  sourceText: string
  locale?: 'fa' | 'en'
}

export default function InstagramCaptionModal({ sourceText, locale = 'fa' }: Props) {
  const [tone, setTone] = useState('engaging')
  const [loading, setLoading] = useState(false)
  const [caption, setCaption] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const isEn = locale === 'en'

  const tones = [
    { id: 'engaging', labelFa: '🔥 اکسپلوری / جذاب', labelEn: '🔥 Viral / Hook' },
    { id: 'professional', labelFa: '🧠 تخصصی / آموزشی', labelEn: '🧠 Professional' },
    { id: 'friendly', labelFa: '☕ صمیمی / داستانی', labelEn: '☕ Friendly' },
    { id: 'minimal', labelFa: '⚡ مینیمال / کوتاه', labelEn: '⚡ Minimal' },
  ]

  const handleGenerate = async () => {
    if (!sourceText || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sourceText, tone, locale }),
      })
      const data = await res.json()
      if (data.caption) {
        setCaption(data.caption)
      } else {
        alert(data.error || 'خطا در تولید کپشن')
      }
    } catch {
      alert('خطا در ارتباط با سرور')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl border border-pink-500/40 bg-pink-500/10 px-4 py-2 text-xs font-bold text-pink-300 transition hover:bg-pink-500/20"
      >
        <span>📸</span>
        <span>{isEn ? 'Generate Instagram Caption' : 'تولید کپشن اینستاگرام با AI'}</span>
      </button>

      {isOpen && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-[#120f0c] p-4 text-ink">
          <p className="text-xs font-bold text-ink-muted">
            {isEn ? 'Select Caption Tone:' : 'انتخاب لحن کپشن:'}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {tones.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTone(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  tone === t.id
                    ? 'border border-pink-500 bg-pink-500 text-black font-bold'
                    : 'border border-white/10 bg-black/40 text-zinc-300 hover:border-white/30'
                }`}
              >
                {isEn ? t.labelEn : t.labelFa}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="btn-primary mt-4 w-full py-2.5 text-xs"
          >
            {loading ? 'در حال نگارش کپشن...' : isEn ? '✨ Generate Caption' : '✨ نوشتن کپشن'}
          </button>

          {caption && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/50 p-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-[11px] font-bold text-pink-400">
                  {isEn ? 'Generated Caption:' : 'کپشن تولید شده:'}
                </span>
                <CopyButton text={caption} label={isEn ? 'Copy' : 'کپی'} copiedLabel={isEn ? 'Copied' : 'کپی شد'} />
              </div>
              <p dir={locale === 'fa' ? 'rtl' : 'ltr'} className="mt-2 whitespace-pre-wrap text-xs leading-6 text-zinc-200">
                {caption}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
