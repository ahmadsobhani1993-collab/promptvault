'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function Analytics() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname.startsWith('/admin') || 
        pathname.startsWith('/api') || 
        pathname.startsWith('/_next') ||
        pathname === '/favicon.ico') {
      return
    }

    console.log('[Analytics] Tracking pageview:', pathname)

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        path: pathname, 
        referrer: typeof document !== 'undefined' ? document.referrer : '' 
      }),
      keepalive: true,
    })
    .then(res => res.json())
    .then(data => console.log('[Analytics] Tracked successfully:', data))
    .catch(err => console.error('[Analytics] Track failed:', err))
  }, [pathname])

  return null
}
