'use client'

import { useState, useTransition } from 'react'

export default function RealLikeButton({
  promptId,
  initialLiked,
  initialCount,
  label,
  requireLogin,
}: {
  promptId: string
  initialLiked: boolean
  initialCount: number
  label: string
  requireLogin: string
}) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, startTransition] = useTransition()

  const toggle = async () => {
    const newLiked = !liked
    setLiked(newLiked)
    setCount((c) => c + (newLiked ? 1 : -1))
    const res = await fetch('/api/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptId, action: newLiked ? 'like' : 'unlike' }),
    })
    if (res.status === 401) {
      alert(requireLogin)
      setLiked(!newLiked)
      setCount((c) => c + (newLiked ? -1 : 1))
      window.location.href = '/login'
    }
  }

  return (
    <button
      type="button"
      onClick={() => startTransition(toggle)}
      disabled={pending}
      className={liked ? 'btn-primary' : 'btn-secondary'}
    >
      <svg
        viewBox="0 0 24 24"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />
      </svg>
      {count} {label}
    </button>
  )
}
