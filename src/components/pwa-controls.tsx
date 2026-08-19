'use client'

import { useEffect, useState } from 'react'

export default function PWAControls() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true)
        return
      }

      const handler = (e: any) => {
        e.preventDefault()
        setDeferredPrompt(e)
      }

      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setIsInstalled(true)
      }
    }
  }

  if (isInstalled || !deferredPrompt) return null

  return (
    <button
      onClick={handleInstall}
      className="fixed bottom-4 right-4 z-[9999] flex h-12 w-12 items-center justify-center rounded-full bg-gold/90 text-black shadow-2xl transition-all hover:scale-110 active:scale-95 md:bottom-6 md:right-6"
      title="نصب اپلیکیشن"
      style={{ pointerEvents: 'auto' }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  )
}
