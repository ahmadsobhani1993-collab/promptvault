'use client'

import { useState, useTransition } from 'react'

export default function RealLikeButton({
  promptId,
  initialLiked = false,
  initialCount = 0,
  requireLogin = 'لطفاً وارد شوید',
}: {
  promptId: string
  initialLiked?: boolean
  initialCount?: number
  label?: string
  requireLogin?: string
}) {
  const [liked, setLiked] = useState(initialLiked)
  const [pending, startTransition] = useTransition()

  const toggle = async () => {
    const next = !liked
    setLiked(next)
    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId, action: next ? 'like' : 'unlike' }),
      })
      if (res.status === 401) {
        alert(requireLogin)
        setLiked(!next)
        window.location.href = '/login'
      }
    } catch {
      setLiked(!next)
    }
  }

  return (
    <button
      type="button"
      onClick={() => startTransition(toggle)}
      disabled={pending}
      aria-label="پسندیدن"
      className={`grid h-8 w-8 place-items-center rounded-full border backdrop-blur transition-colors ${
        liked
          ? 'border-gold/60 bg-gold/20 text-gold-bright'
          : 'border-line/60 bg-[#0b0b0b]/80 text-ink-muted hover:text-gold-bright'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  )
}