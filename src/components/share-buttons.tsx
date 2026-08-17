'use client'

import { useState } from 'react'

export default function ShareButtons({ title, desc }: { title: string; desc: string }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = window.location.href
    const text = '✨ ' + title + (desc ? '\n' + desc : '')
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: '✨ ' + title, text, url })
        return
      } catch {
        return
      }
    }
    window.open(
      'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text),
      '_blank'
    )
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
        📤 اشتراک
      </button>
      <button type="button" onClick={copy} className="btn-secondary px-3" title="کپی لینک">
        {copied ? '✅' : '🔗'}
      </button>
    </div>
  )
}
