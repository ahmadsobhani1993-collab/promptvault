'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function Analytics() {
  const pathname = usePathname()

  useEffect(() => {
    // Skip admin and API routes
    if (pathname.startsWith('/admin') || pathname.startsWith('/api')) return

    const send = async () => {
      try {
        await fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            path: pathname, 
            referrer: typeof document !== 'undefined' ? document.referrer : '' 
          }),
          keepalive: true,
        })
      } catch (err) {
        // Silently fail
      }
    }

    send()
  }, [pathname])

  return null
}
