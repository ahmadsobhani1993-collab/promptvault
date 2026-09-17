'use client'

import { useState } from 'react'

export default function CopyButton({ 
  text, 
  label, 
  copiedLabel 
}: { 
  text: string
  label: string
  copiedLabel: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      
      // فعال‌سازی لرزش فیدبک لمسی روی موبایل
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([18, 30, 24])
      }

      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback در صورت مسدود بودن کلیپ‌بورد مدرن
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)

      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(25)
      }

      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      type="button"
      className={`relative inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold tracking-wide transition-all duration-200 active:scale-95 ${
        copied
          ? 'border border-emerald-500/60 bg-emerald-500/15 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
          : 'border border-gold/40 bg-gold/10 text-gold hover:border-gold hover:bg-gold/20 hover:shadow-[0_0_12px_rgba(245,185,66,0.25)]'
      }`}
    >
      <span className="text-sm">{copied ? '✓' : '📋'}</span>
      <span>{copied ? copiedLabel : label}</span>
    </button>
  )
}
