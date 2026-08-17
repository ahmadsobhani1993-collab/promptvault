'use client'

import { useEffect } from 'react'

export default function RouteLoader() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a')
      if (!a) return
      const href = a.getAttribute('href') || ''
      if (!href.startsWith('/') || a.target === '_blank' || e.metaKey || e.ctrlKey) return
      e.preventDefault()
      document.body.classList.add('route-loading')
      setTimeout(() => { window.location.href = href }, 700)
    }
    document.addEventListener('click', handler)
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
