'use client'

import { useState } from 'react'

export default function CopyButton({
  text,
  label,
  copiedLabel,
  isLoggedIn = false,
}: {
  text: string
  label: string
  copiedLabel: string
  isLoggedIn?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [showWarning, setShowWarning] = useState(false)

  const handleClick = async () => {
    if (!isLoggedIn) {
      setShowWarning(true)
      setTimeout(() => setShowWarning(false), 2000)
      return
    }

    try {
      await navigator.clipboard.writeText(text)
    } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="btn-primary"
    >
      {showWarning ? 'برای کپی باید وارد شوید' : copied ? copiedLabel : label}
    </button>
  )
}
