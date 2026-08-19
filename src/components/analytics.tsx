'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function Analytics() {
  const pathname = usePathname()

  useEffect(() => {
    // Skip admin, API, and static routes
    if (pathname.startsWith('/admin') || 
        pathname.startsWith('/api') || 
        pathname.startsWith('/_next') ||
        pathname === '/favicon.ico') {
      return
    }

    // Send pageview
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        path: pathname, 
        referrer: typeof document !== 'undefined' ? document.referrer : '' 
      }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}
