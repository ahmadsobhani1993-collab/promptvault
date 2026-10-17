'use client'

import Image from 'next/image'
import { useState } from 'react'
import { getImageUrl } from '@/lib/image-utils'

const FALLBACK = 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop'

export default function SafeImg({
  src, alt, className, loading, isDetail = false, width, height, fill
}: {
  src: string; alt: string; className?: string; loading?: 'lazy' | 'eager'
  isDetail?: boolean; width?: number; height?: number; fill?: boolean
}) {
  const resolvedSrc = getImageUrl(src)
  const [cur, setCur] = useState(resolvedSrc)
  const isVideo = !!cur && (cur.match(/\.(mp4|webm|ogg|mov)($|\?)/i) || cur.includes('/video/upload/'))

  const getVideoSource = (url: string) => url.includes('#t=') ? url : `${url}#t=0.001`
  const getCloudinaryPoster = (url: string) => 
    url.includes('res.cloudinary.com') && url.includes('/video/upload/') 
      ? url.replace(/\/video\/upload\/(?:v\d+\/)?/, '$&so_0,f_jpg/').replace(/\.[^/.]+$/, '.jpg') 
      : undefined

  if (isVideo && !isDetail) {
    return (
      <div className="relative w-full h-full overflow-hidden bg-black/40">
        <video src={getVideoSource(cur)} poster={getCloudinaryPoster(cur)} preload="metadata" muted playsInline className={`${className} pointer-events-none object-cover w-full h-full`} />
        <div className="absolute bottom-2 left-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 backdrop-blur text-gold-bright pointer-events-none">
          <svg className="h-3 w-3 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        </div>
      </div>
    )
  }

  if (isVideo && isDetail) {
    return (
      <div className="relative w-full overflow-hidden rounded-2xl border border-line bg-[#0B0B0D] aspect-[4/3] md:aspect-video flex items-center justify-center shadow-lg">
        <video src={getVideoSource(cur)} poster={getCloudinaryPoster(cur)} controls playsInline preload="metadata" className="w-full h-full object-contain">مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.</video>
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
