'use client'

import { useState } from 'react'

const FALLBACK = 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop'

export default function SafeImg({
  src,
  alt,
  className,
  loading,
  isDetail = false,
}: {
  src: string
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
  isDetail?: boolean
}) {
  const [cur, setCur] = useState(src)
  const isVideo = !!cur && (cur.match(/\.(mp4|webm|ogg|mov)$/i) || cur.includes('/video/upload/'))

  const getPosterUrl = (url: string) => {
    if (url.includes('/video/upload/')) {
      return url.replace(/\/video\/upload\/(?:v\d+\/)?/, '$&so_0,f_jpg/').replace(/\.[^/.]+$/, '.jpg')
    }
    return url.replace(/\.[^/.]+$/, '.jpg')
  }

  // در کارت‌ها: فقط تصویر ثابت (تامبنیل فریم صفر) بدون ساخت پلیر ویدیو
  if (isVideo && !isDetail) {
    const poster = getPosterUrl(cur)
    return (
      <div className="relative w-full h-full overflow-hidden">
        <img
          src={poster}
          alt={alt}
          className={className}
          loading={loading ?? 'lazy'}
          onError={() => {
            if (cur !== FALLBACK) setCur(FALLBACK)
          }}
        />
        <div className="absolute bottom-2 left-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 backdrop-blur text-gold-bright pointer-events-none">
          <svg className="h-3 w-3 fill-current ml-0.5" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    )
  }

  // در صفحه داخلی: پلیر ویدیویی با ابعاد متناسب و پوستر آماده
  if (isVideo && isDetail) {
    const poster = getPosterUrl(cur)
    return (
      <div className="relative w-full overflow-hidden rounded-2xl border border-line bg-[#0B0B0D] aspect-[4/3] md:aspect-video flex items-center justify-center shadow-lg">
        <video
          src={cur}
          poster={poster}
          controls
          playsInline
          preload="metadata"
          className="w-full h-full object-contain"
        >
          مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.
        </video>
      </div>
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