'use client'

import { useState } from 'react'

const FALLBACK = 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop'

export default function SafeImg({
  src,
  alt,
  className,
  loading,
}: {
  src: string
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
}) {
  const [cur, setCur] = useState(src)
  return (
    <img
      src={cur}
      alt={alt}
      className={className}
      loading={loading ?? 'lazy'}
      onError={() => {
        if (cur !== FALLBACK) setCur(FALLBACK)
      }}
    />
  )
}
