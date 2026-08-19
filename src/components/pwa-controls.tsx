'use client'

import { useEffect, useState } from 'react'

export default function PWAControls() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check if already installed
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true)
        console.log('📱 Already installed as PWA')
        return
      }

      const handler = (e: any) => {
        console.log('✅ PWA install prompt available')
        e.preventDefault()
        setDeferredPrompt(e)
        setShowDebug(true)
      }

      window.addEventListener('beforeinstallprompt', handler)
      
      // Debug: check after 3 seconds
      setTimeout(() => {
        if (!deferredPrompt) {
          console.warn('⚠️ No PWA install prompt after 3s')
        }
      }, 3000)
      
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    console.log('🔧 Install clicked')
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      console.log('📊 Install outcome:', outcome)
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setIsInstalled(true)
      }
    } else {
      alert('📲 برای نصب:\n\n• Chrome موبایل: منوی سه‌نقطه → "Add to Home Screen"\n• Safari iOS: Share → "Add to Home Screen"')
    }
  }

  if (isInstalled) {
    console.log('✅ PWA installed, hiding button')
    return null
  }

  if (!deferredPrompt) {
    console.log('⏳ Waiting for install prompt...')
    return null
  }

  console.log('🎯 Rendering PWA button')
  
  return (
    <button
      onClick={handleInstall}
      className="fixed bottom-4 right-4 z-[9999] flex h-12 w-12 items-center justify-center rounded-full bg-gold/90 text-black shadow-2xl transition-all hover:scale-110 active:scale-95 md:bottom-6 md:right-6"
      title="نصب اپلیکیشن"
      style={{ pointerEvents: 'auto', position: 'fixed' }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  )
}
