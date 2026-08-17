'use client'

import { useState } from 'react'
import CopyButton from '@/components/copy-button'

export default function PromptReveal({
  slug,
  revealLabel,
  copyLabel,
  copiedLabel,
  hint,
}: {
  slug: string
  revealLabel: string
  copyLabel: string
  copiedLabel: string
  hint: string
}) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      <p className="text-xs font-bold text-gold-bright">Prompt</p>
      <p dir="ltr" className="mt-3 text-left font-mono text-sm leading-7 text-[#e8d9ae]">{text}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <CopyButton text={text} label={copyLabel} copiedLabel={copiedLabel} />
        <span className="text-[10px] text-ink-faint">کپی شد؟ برو امتحانش کن:</span>
        <a className="badge hover:border-gold/60 hover:text-gold-bright" target="_blank" rel="noreferrer" href="https://chat.openai.com">ChatGPT</a>
        <a className="badge hover:border-gold/60 hover:text-gold-bright" target="_blank" rel="noreferrer" href="https://www.midjourney.com">Midjourney</a>
        <a className="badge hover:border-gold/60 hover:text-gold-bright" target="_blank" rel="noreferrer" href="https://gemini.google.com">Gemini</a>
      </div>
    </div>
  )
}
