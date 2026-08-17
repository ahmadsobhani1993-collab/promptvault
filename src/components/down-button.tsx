'use client'

import { useEffect, useState } from 'react'

export default function DownButton() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80
      setHidden(nearBottom)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      aria-label="پایین"
      onClick={() => window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' })}
      className={
        'fixed bottom-6 left-1/2 z-30 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-full border border-gold/50 bg-[#0a0805]/80 text-gold-bright backdrop-blur transition-all duration-700 ' +
        (hidden ? 'pointer-events-none translate-y-20 rotate-180 scale-50 opacity-0' : 'opacity-100')
      }
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  )
}
