'use client'

import { useState } from 'react'

export default function CopyButton({
  text,
  label,
  copiedLabel,
}: {
  text: string
  label: string
  copiedLabel: string
}) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {}
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="btn-primary"
    >
      {copied ? copiedLabel : label}
    </button>
  )
}
