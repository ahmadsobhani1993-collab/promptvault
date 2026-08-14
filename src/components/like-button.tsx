'use client'

import { useState } from 'react'

export default function LikeButton({
  initial,
  label,
}: {
  initial: number
  label: string
}) {
  const [liked, setLiked] = useState(false)

  return (
    <button
      type="button"
      onClick={() => setLiked(!liked)}
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
      {initial + (liked ? 1 : 0)} {label}
    </button>
  )
}
