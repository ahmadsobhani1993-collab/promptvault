'use client'

import { useState } from 'react'

export default function SaveButton({
  promptId,
  initialSaved,
  initialCount,
  label,
  requireLogin,
}: {
  promptId: string
  initialSaved: boolean
  initialCount: number
  label: string
  requireLogin: string
}) {
  const [saved, setSaved] = useState(initialSaved)
  const [count, setCount] = useState(initialCount)

  const toggle = async () => {
    const next = !saved
    setSaved(next)
    setCount((c) => c + (next ? 1 : -1))
    const res = await fetch('/api/saves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptId, action: next ? 'save' : 'unsave' }),
    })
    if (res.status === 401) {
      alert(requireLogin)
      setSaved(!next)
      setCount((c) => c + (next ? -1 : 1))
      window.location.href = '/login'
    }
  }

  return (
    <button type="button" onClick={toggle} className={saved ? 'btn-primary' : 'btn-secondary'}>
      <svg
        viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      {count} {label}
    </button>
  )
}
