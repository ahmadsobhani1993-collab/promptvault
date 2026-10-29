'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

const ENDPOINT = '/api/track/batch'
const DEDUPE_MS = 30 * 60 * 1000
const PROMPT_PATH = /^\/(en\/)?prompts\/[^/]+\/?$/

// Same prompt in the same tab within 30 minutes is counted once
function seenRecently(path: string): boolean {
  try {
    const key = 'pf_v:' + path
    const last = Number(sessionStorage.getItem(key) || 0)
    if (DEDUPE_MS > 0 && last && Date.now() - last < DEDUPE_MS) return true
    sessionStorage.setItem(key, String(Date.now()))
  } catch {}
  return false
}

export default function Analytics() {
  const pathname = usePathname()
  const bufferRef = useRef<any[]>([])
  const lastPathRef = useRef<string | null>(null)

  function flush(useBeacon: boolean) {
    if (bufferRef.current.length === 0) return
    const batch = bufferRef.current
    bufferRef.current = []
    const body = JSON.stringify(batch)

    if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
      if (ok) return
    }

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      bufferRef.current = [...batch, ...bufferRef.current].slice(0, 50)
    })
  }

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return
    if (
      !pathname ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/_next') ||
      pathname === '/favicon.ico'
    ) {
      return
    }
    if (lastPathRef.current === pathname) return
    lastPathRef.current = pathname

    if (PROMPT_PATH.test(pathname) && seenRecently(pathname)) return

    bufferRef.current.push({
      path: pathname,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      ts: Date.now(),
    })

    if (bufferRef.current.length >= 10) flush(false)
  }, [pathname])

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return

    const interval = setInterval(() => flush(false), 30000)
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush(true)
    }
    const onPageHide = () => flush(true)

    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [])

  return null
}