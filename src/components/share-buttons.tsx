'use client'

import { useState } from 'react'

export default function ShareButtons({ title, desc }: { title: string; desc: string }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = window.location.href
    const text = '✨ ' + title + (desc ? '\n' + desc : '')
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try { await (navigator as any).share({ title: '✨ ' + title, text, url }); return } catch { return }
    }
    window.open('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text), '_blank')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={share} className="btn-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        اشتراک
      </button>
      <button type="button" onClick={copy} className="btn-secondary" title="کپی لینک">
        {copied ? '✅' : '🔗'}
      </button>
    </div>
  )
}
