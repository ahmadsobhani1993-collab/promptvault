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
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`btn-primary transition-all ${copied ? 'bg-green-600 hover:bg-green-700' : ''}`}
    >
      {copied ? copiedLabel : label}
    </button>
  )
}