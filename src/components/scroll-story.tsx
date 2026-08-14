'use client'

import { useEffect, useRef } from 'react'

export interface StorySection {
  img: string
  title: string
  subtitle: string
}

export default function ScrollStory({ sections }: { sections: StorySection[] }) {
  const refs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    let raf = 0

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const vh = window.innerHeight
        refs.current.forEach((el) => {
          if (!el) return
          const img = el.querySelector('img')
          const content = el.querySelector('[data-content]') as HTMLElement | null
          const rect = el.getBoundingClientRect()
          const progress = Math.min(Math.max((vh - rect.top) / (vh + rect.height), 0), 1)
          const scale = 1.18 - progress * 0.18
          const opacity = Math.min(Math.max((vh - rect.top) / vh, 0), 1)
          if (img) img.style.transform = 'scale(' + scale.toFixed(3) + ')'
          if (content) content.style.opacity = Math.min(1, opacity * 1.3).toFixed(2)
        })
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
    <div>
      {sections.map((s, i) => (
        <div
          key={s.title}
          ref={(el) => {
            refs.current[i] = el
          }}
          className="relative flex h-[80vh] items-center justify-center overflow-hidden"
        >
          <img
            src={s.img}
            alt={s.title}
            className="absolute inset-0 h-full w-full object-cover opacity-40 will-change-transform"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-base via-base/40 to-base" />
          <div data-content className="relative z-10 px-6 text-center">
            <h2 className="glow-text font-display text-3xl font-extrabold md:text-5xl">
              {s.title}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-ink-muted md:text-base">
              {s.subtitle}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
