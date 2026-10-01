'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function Analytics() {
  const pathname = usePathname()
  const bufferRef = useRef<any[]>([])

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return
    if (pathname.startsWith('/admin') || 
        pathname.startsWith('/api') || 
        pathname.startsWith('/_next') ||
        pathname === '/favicon.ico') {
      return
    }

    // Add to buffer
    bufferRef.current.push({
      path: pathname,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      ts: Date.now(),
    })

    // Flush every 10 pageviews or 30 seconds
    if (bufferRef.current.length >= 10) {
      flushBuffer()
    }
  }, [pathname])

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return
    const interval = setInterval(() => {
      if (bufferRef.current.length > 0) {
        flushBuffer()
      }
    }, 30000) // 30 seconds

    // Flush on unload
    const handleUnload = () => {
      if (bufferRef.current.length > 0) {
        navigator.sendBeacon('/api/track/batch', JSON.stringify(bufferRef.current))
      }
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [])

  const flushBuffer = async () => {
    if (bufferRef.current.length === 0) return

    const batch = [...bufferRef.current]
    bufferRef.current = []

    try {
      await fetch('/api/track/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
        keepalive: true,
      })
    } catch (err) {
      // Re-add to buffer on failure
      bufferRef.current = [...batch, ...bufferRef.current]
    }
  }

  return null
}
