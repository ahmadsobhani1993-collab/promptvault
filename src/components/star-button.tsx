'use client'

import { useEffect, useState } from 'react'

export default function StarButton({
  promptId,
  initial,
  label,
}: {
  promptId: string
  initial: number
  label: string
}) {
  const safe = Number.isFinite(initial) ? initial : 0
  const [count, setCount] = useState(safe)
  const [starred, setStarred] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('star-' + promptId)) setStarred(true)
  }, [promptId])

  const give = async () => {
    if (starred) return
    setStarred(true)
    localStorage.setItem('star-' + promptId, '1')
    setCount((c) => c + 1)
    const res = await fetch('/api/stars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptId }),
    })
    if (res.ok) {
      const j = await res.json()
      if (Number.isFinite(j.stars)) setCount(j.stars)
    }
  }

  return (
    <button type="button" onClick={give} className={starred ? 'btn-primary' : 'btn-secondary'} title={label}>
      <svg viewBox="0 0 24 24" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
      </svg>
      {count} {label}
    </button>
  )
}
