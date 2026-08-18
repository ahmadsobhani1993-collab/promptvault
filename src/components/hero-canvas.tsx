'use client'

import { useEffect, useRef } from 'react'

type P = { x: number; y: number; r: number; vy: number; vx: number; tw: number; ph: number }

export default function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const canvas = ref.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const N = 70
    const parts: P[] = Array.from({ length: N }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 1200,
      r: Math.random() * 1.6 + 0.4,
      vy: -(Math.random() * 0.25 + 0.06),
      vx: (Math.random() - 0.5) * 0.12,
      tw: Math.random() * 2 + 1,
      ph: Math.random() * Math.PI * 2,
    }))

    let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null
    let t = 0

    const draw = () => {
      t += 0.016
      ctx.clearRect(0, 0, w, h)

      // drifting nebula glows
      const g1 = ctx.createRadialGradient(w * 0.8 + Math.sin(t * 0.1) * 60, h * 0.2, 0, w * 0.8, h * 0.2, w * 0.45)
      g1.addColorStop(0, 'rgba(212,169,78,0.10)')
      g1.addColorStop(1, 'rgba(212,169,78,0)')
      ctx.fillStyle = g1
      ctx.fillRect(0, 0, w, h)

      const g2 = ctx.createRadialGradient(w * 0.15, h * 0.85 + Math.cos(t * 0.08) * 50, 0, w * 0.15, h * 0.85, w * 0.4)
      g2.addColorStop(0, 'rgba(240,212,145,0.07)')
      g2.addColorStop(1, 'rgba(240,212,145,0)')
      ctx.fillStyle = g2
      ctx.fillRect(0, 0, w, h)

      // golden particles
      for (const p of parts) {
        p.y += p.vy
        p.x += p.vx
        if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w }
        if (p.x < -5) p.x = w + 5
        if (p.x > w + 5) p.x = -5
        const a = 0.25 + 0.55 * Math.abs(Math.sin(t * p.tw + p.ph))
        ctx.beginPath()
        ctx.arc(p.x % (w + 10), p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(240,212,145,' + a.toFixed(2) + ')'
        ctx.fill()
      }

      // shooting star
      if (!shoot && Math.random() < 0.006) {
        shoot = { x: Math.random() * w * 0.7 + w * 0.2, y: Math.random() * h * 0.3, vx: -7, vy: 3, life: 1 }
      }
      if (shoot) {
        shoot.x += shoot.vx
        shoot.y += shoot.vy
        shoot.life -= 0.02
        const grad = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x + 90, shoot.y - 40)
        grad.addColorStop(0, 'rgba(240,212,145,' + (0.8 * shoot.life).toFixed(2) + ')')
        grad.addColorStop(1, 'rgba(240,212,145,0)')
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(shoot.x, shoot.y)
        ctx.lineTo(shoot.x + 90, shoot.y - 40)
        ctx.stroke()
        if (shoot.life <= 0) shoot = null
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className="h-full w-full" />
}
