'use client'

import { useEffect, useRef } from 'react'

export default function ZoomSection({
  children,
}: {
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const inner = el.firstElementChild as HTMLElement | null
        if (!inner) return
        const rect = el.getBoundingClientRect()
        const vh = window.innerHeight
        const center = rect.top + rect.height / 2
        const p = (vh / 2 - center) / vh

        if (p >= 0) {
          const k = Math.min(p * 1.4, 1)
          inner.style.transform = 'scale(' + (1 - 0.18 * k).toFixed(3) + ')'
          inner.style.opacity = String(Math.max(1 - k * 1.1, 0))
        } else {
          const k = Math.min(-p * 1.4, 1)
          inner.style.transform = 'scale(' + (1 - 0.12 * k).toFixed(3) + ')'
          inner.style.opacity = String(Math.max(1 - k * 0.9, 0.1))
        }
      })
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={ref}>
      <div className="will-change-transform" style={{ transformOrigin: 'center center' }}>
        {children}
      </div>
    </div>
  )
}
