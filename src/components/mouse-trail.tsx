'use client'

import { useEffect, useRef } from 'react'

export default function MouseTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const particles: {
      x: number
      y: number
      vx: number
      vy: number
      life: number
      maxLife: number
      size: number
      hue: number
    }[] = []

    let mouseX = -100
    let mouseY = -100
    let lastX = mouseX
    let lastY = mouseY

    const handleResize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    const handleMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('mousemove', handleMove)

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      // اضافه کردن ذرات جدید بر اساس حرکت موس
      const dx = mouseX - lastX
      const dy = mouseY - lastY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > 2) {
        const steps = Math.min(Math.floor(distance / 3), 5)
        for (let i = 0; i < steps; i++) {
          const t = i / steps
          particles.push({
            x: lastX + dx * t + (Math.random() - 0.5) * 4,
            y: lastY + dy * t + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5 - 0.3,
            life: 1,
            maxLife: 0.6 + Math.random() * 0.4,
            size: 2 + Math.random() * 3,
            hue: 42 + Math.random() * 8, // طلایی
          })
        }
      }

      lastX = mouseX
      lastY = mouseY

      // رسم ذرات
      ctx.globalCompositeOperation = 'lighter'

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life -= 0.015 / p.maxLife
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.02 // گرانش ملایم

        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }

        const alpha = p.life * 0.8
        const size = p.size * p.life

        // glow بیرونی
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 3)
        gradient.addColorStop(0, `hsla(${p.hue}, 80%, 60%, ${alpha})`)
        gradient.addColorStop(0.4, `hsla(${p.hue}, 90%, 50%, ${alpha * 0.5})`)
        gradient.addColorStop(1, `hsla(${p.hue}, 100%, 40%, 0)`)

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2)
        ctx.fill()

        // هسته درخشان
        ctx.fillStyle = `hsla(${p.hue}, 100%, 85%, ${alpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, size * 0.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // محدود کردن تعداد ذرات
      if (particles.length > 150) {
        particles.splice(0, particles.length - 150)
      }

      requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      style={{ mixBlendMode: 'screen' }}
    />
  )
}
