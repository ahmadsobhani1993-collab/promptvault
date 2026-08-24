'use client'

import { useEffect, useState } from 'react'

export default function MouseTrail() {
  const [trail, setTrail] = useState<{ x: number; y: number; id: number }[]>([])

  useEffect(() => {
    let id = 0
    const handleMove = (e: MouseEvent) => {
      id++
      setTrail(prev => [...prev.slice(-15), { x: e.clientX, y: e.clientY, id }])
    }
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {trail.map((point, i) => (
        <div
          key={point.id}
          className="absolute h-2 w-2 rounded-full bg-gold/60"
          style={{
            left: point.x,
            top: point.y,
            opacity: (i + 1) / trail.length,
            transform: `scale(${(i + 1) / trail.length})`,
            transition: 'opacity 0.3s, transform 0.3s',
          }}
        />
      ))}
    </div>
  )
}
