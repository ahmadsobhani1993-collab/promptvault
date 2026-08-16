'use client'

import { useState } from 'react'

export default function ShareButtons({ title, desc }: { title: string; desc: string }) {
  const [copied, setCopied] = useState(false)

  const tgShare = () => {
    const url = window.location.href
    const text = '✨ ' + title + (desc ? '\n' + desc : '')
    window.open(
      'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text),
      '_blank'
    )
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const nativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: '✨ ' + title, text: desc, url: window.location.href })
      } catch {}
    } else {
      tgShare()
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={tgShare} className="btn-secondary">
        📤 {title ? 'اشتراک در تلگرام' : 'Share'}
      </button>
      <button type="button" onClick={copyLink} className="btn-secondary">
        {copied ? '✅ کپی شد' : '🔗 کپی لینک'}
      </button>
      <button type="button" onClick={nativeShare} className="btn-secondary">
        📲 اشتراک
      </button>
    </div>
  )
}
