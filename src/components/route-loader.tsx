'use client'

import { useEffect } from 'react'

export default function RouteLoader() {
  useEffect(() => {
    const start = () => document.body.classList.add('route-loading')
    const stop = () => document.body.classList.remove('route-loading')
    const handler = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a')
      if (!a) return
      const href = a.getAttribute('href') || ''
      if (!href.startsWith('/') || a.target === '_blank' || e.metaKey || e.ctrlKey) return
      start()
      setTimeout(stop, 4000)
    }
    document.addEventListener('click', handler)
    window.addEventListener('load', stop)
    window.addEventListener('pageshow', stop)
    return () => document.removeEventListener('click', handler)
  }, [])

  return <div className="route-bar" aria-hidden="true" />
}
