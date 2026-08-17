'use client'

import { useEffect } from 'react'

export default function RouteLoader() {
  useEffect(() => {
    const show = () => document.body.classList.add('route-loading')
    const handler = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a')
      if (!a) return
      const href = a.getAttribute('href') || ''
      if (!href.startsWith('/') || a.target === '_blank' || e.metaKey || e.ctrlKey) return
      show()
    }
    document.addEventListener('click', handler)
    window.addEventListener('pageshow', () => document.body.classList.remove('route-loading'))
    return () => document.removeEventListener('click', handler)
  }, [])

  return (
    <div className="route-loader" aria-hidden="true">
      <div className="route-loader-box">
        <div className="route-spinner" />
        <p className="route-loader-title">Prompts<span>FA</span></p>
        <p className="route-loader-sub">در حال آماده‌سازی...</p>
      </div>
    </div>
  )
}
