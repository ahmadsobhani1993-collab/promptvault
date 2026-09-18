'use client'

import { useState } from 'react'

export default function ShareButtons({ title, desc }: { title: string; desc: string }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: desc, url: window.location.href })
      } catch {}
    } else {
      copy()
    }
  }

  const copy = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={share}
        aria-label="اشتراک‌گذاری"
        className="grid h-8 w-8 place-items-center rounded-full border border-line/60 bg-[#0b0b0b]/80 text-ink-muted backdrop-blur transition-colors hover:border-gold/60 hover:text-gold-bright"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </button>

      <button
        type="button"
        onClick={copy}
        aria-label="کپی لینک"
        className="grid h-8 w-8 place-items-center rounded-full border border-line/60 bg-[#0b0b0b]/80 text-ink-muted backdrop-blur transition-colors hover:border-gold/60 hover:text-gold-bright"
      >
        {copied ? (
          <span className="text-xs text-gold-bright">✓</span>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        )}
      </button>
    </div>
  )
}