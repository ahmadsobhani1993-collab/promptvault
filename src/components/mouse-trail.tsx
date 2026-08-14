'use client'

import { useEffect, useRef } from 'react'

export default function MouseTrail() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let last = 0

    const onMove = (e: MouseEvent) => {
      const now = performance.now()
      if (now - last < 45) return
      last = now

      const star = document.createElement('span')
      star.className = 'trail-star'
      star.textContent = '✦'
      star.style.fontSize = 8 + Math.random() * 8 + 'px'
      star.style.left = e.clientX + 'px'
      star.style.top = e.clientY + 'px'
      star.style.setProperty('--dx', Math.random() * 44 - 22 + 'px')
      star.style.setProperty('--dy', -12 - Math.random() * 30 + 'px')

      el.appendChild(star)
      setTimeout(() => star.remove(), 800)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed inset-0 z-[70] overflow-hidden"
    />
  )
}
