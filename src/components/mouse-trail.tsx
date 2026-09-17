'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  baseAlpha: number
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  life: number
  maxLife: number
  color: string
}

export default function MouseTrail() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const mouse = { x: -1000, y: -1000, prevX: -1000, prevY: -1000, active: false }

    const handleResize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    // ذرات شناور پس‌زمینه
    const particleCount = Math.min(Math.floor((width * height) / 15000), 60)
    const particles: Particle[] = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 2 + 1,
      baseAlpha: Math.random() * 0.35 + 0.15,
    }))

    const sparks: Spark[] = []

    const handleMouseMove = (e: MouseEvent) => {
      mouse.prevX = mouse.active ? mouse.x : e.clientX
      mouse.prevY = mouse.active ? mouse.y : e.clientY
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.active = true

      const dist = Math.hypot(mouse.x - mouse.prevX, mouse.y - mouse.prevY)
      const steps = Math.min(Math.max(Math.floor(dist / 4), 2), 6)

      for (let i = 0; i < steps; i++) {
        const ratio = i / steps
        const px = mouse.prevX + (mouse.x - mouse.prevX) * ratio
        const py = mouse.prevY + (mouse.y - mouse.prevY) * ratio

        sparks.push({
          x: px + (Math.random() - 0.5) * 5,
          y: py + (Math.random() - 0.5) * 5,
          vx: (Math.random() - 0.5) * 0.7,
          vy: Math.random() * 0.6 - 0.1,
          size: Math.random() * 2.5 + 1.8,
          life: 0,
          maxLife: Math.random() * 20 + 32, // مقدار متعادل و محوشدن نرم
          color: Math.random() > 0.25 ? '245, 185, 66' : '255, 225, 150',
        })
      }
    }

    const handleMouseLeave = () => {
      mouse.active = false
      mouse.x = -1000
      mouse.y = -1000
    }

    const handleClick = (e: MouseEvent) => {
      for (let i = 0; i < 22; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = Math.random() * 4 + 1.5
        sparks.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 3 + 1.5,
          life: 0,
          maxLife: Math.random() * 25 + 20,
          color: '255, 205, 80',
        })
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('click', handleClick)

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      // ذرات شبکه و اتصالات
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy

        if (p.x < 0) p.x = width
        if (p.x > width) p.x = 0
        if (p.y < 0) p.y = height
        if (p.y > height) p.y = 0

        if (mouse.active) {
          const dx = mouse.x - p.x
          const dy = mouse.y - p.y
          const dist = Math.hypot(dx, dy)
          if (dist < 130) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(245, 185, 66, ${0.3 * (1 - dist / 130)})`
            ctx.lineWidth = 0.8
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(mouse.x, mouse.y)
            ctx.stroke()
          }
        }

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]
          const dx = p.x - p2.x
          const dy = p.y - p2.y
          const dist = Math.hypot(dx, dy)
          if (dist < 85) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(230, 175, 45, ${0.1 * (1 - dist / 85)})`
            ctx.lineWidth = 0.5
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
          }
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(245, 185, 66, ${p.baseAlpha})`
        ctx.fill()
      }

      // رسم جرقه‌های دنباله
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.x += s.vx
        s.y += s.vy
        s.life++

        const progress = s.life / s.maxLife
        const alpha = Math.max(0, 1 - progress)

        ctx.save()
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size * (1 - progress * 0.35), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${s.color}, ${alpha})`
        ctx.shadowColor = `rgba(${s.color}, 0.8)`
        ctx.shadowBlur = 10
        ctx.fill()
        ctx.restore()

        if (s.life >= s.maxLife) {
          sparks.splice(i, 1)
        }
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('click', handleClick)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-10 h-full w-full opacity-85"
    />
  )
}
