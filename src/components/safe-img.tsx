'use client'

import Image from 'next/image'
import { useState } from 'react'
import { getImageUrl, getVideoPosterUrl } from '@/lib/image-utils'

const FALLBACK = '/placeholder.jpg'

export default function SafeImg({
  src, alt, className, loading, isDetail = false, width, height, fill
}: {
  src: string; alt: string; className?: string; loading?: 'lazy' | 'eager'
  isDetail?: boolean; width?: number; height?: number; fill?: boolean
}) {
  const resolvedSrc = getImageUrl(src)
  const [cur, setCur] = useState(resolvedSrc)
  const isVideo = !!cur && (cur.match(/\.(mp4|webm|ogg|ogv|mov)($|\?)/i) || cur.includes('/video/upload/'))

  const seekToPreviewFrame = (video: HTMLVideoElement) => {
    if (Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = Math.min(Math.max(video.duration * 0.08, 0.25), 1.5)
    }
  }

  if (isVideo && !isDetail) {
    return (
      <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-[#24201a] to-black">
        <video
          src={cur}
          preload="metadata"
          muted
          playsInline
          poster={getVideoPosterUrl(cur)}
          onLoadedData={(event) => seekToPreviewFrame(event.currentTarget)}
          onSeeked={(event) => event.currentTarget.pause()}
          className={`${className} pointer-events-none object-cover w-full h-full`}
        />
        <div className="absolute bottom-2 left-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 backdrop-blur text-gold-bright pointer-events-none">
          <svg className="h-3 w-3 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        </div>
      </div>
    )
  }

  if (isVideo && isDetail) {
    return (
      <div className="relative w-full overflow-hidden rounded-2xl border border-line bg-[#0B0B0D] aspect-[4/3] md:aspect-video flex items-center justify-center shadow-lg">
        <video
          src={cur}
          controls
          playsInline
          preload="metadata"
          onLoadedMetadata={(event) => seekToPreviewFrame(event.currentTarget)}
          className="w-full h-full object-contain"
        >مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.</video>
      </div>
    )
  }

  if (fill) {
    return (
      <div className="relative w-full h-full">
        <Image src={cur} alt={alt} fill className={`object-cover ${className}`} loading={loading ?? 'lazy'} onError={() => cur !== FALLBACK && setCur(FALLBACK)} />
      </div>
    )
  }

  return (
    <Image
      src={cur} alt={alt}
      width={width || 400} height={height || 300}
      className={className} loading={loading ?? 'lazy'}
      onError={() => cur !== FALLBACK && setCur(FALLBACK)}
    />
  )
}
