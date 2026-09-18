'use client'

import { useState } from 'react'

export default function SaveButton({
  promptId,
  initialSaved = false,
  requireLogin = 'لطفا ابتدا وارد شوید',
}: {
  promptId: string
  initialSaved?: boolean
  initialCount?: number
  label?: string
  requireLogin?: string
}) {
  const [saved, setSaved] = useState(initialSaved)

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const next = !saved
    setSaved(next)
    const res = await fetch('/api/saves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptId, action: next ? 'save' : 'unsave' }),
    })
    if (res.status === 401) {
      alert(requireLogin)
      setSaved(!next)
      window.location.href = '/login'
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="نشان کردن"
      className={`grid h-8 w-8 place-items-center rounded-full border backdrop-blur transition-colors ${
        saved
          ? 'border-gold/60 bg-gold/20 text-gold-bright'
          : 'border-line/60 bg-[#0b0b0b]/80 text-ink-muted hover:text-gold-bright'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  )
}