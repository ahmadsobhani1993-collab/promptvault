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
  const isVideo = !!cur && (cur.match(/\.(mp4|webm|ogg|mov)$/i) || cur.includes('/video/upload/'))

  if (isVideo) {
    // تامبنیل فریم اول کلودینری به عنوان پوستر ویدیو
    const posterUrl = cur.includes('/video/upload/')
      ? cur.replace(/\/video\/upload\/(?:v\d+\/)?/, '$&so_0/').replace(/\.[^/.]+$/, '.jpg')
      : undefined

    return (
      <video
        src={cur}
        poster={posterUrl}
        controls
        playsInline
        preload="metadata"
        className={className || "w-full rounded-2xl bg-black"}
      >
        مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.
      </video>
    )
  }

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