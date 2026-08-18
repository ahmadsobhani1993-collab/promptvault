#!/bin/bash
set -e

# ---------- 1) PWA Controls: Centered Bottom Install Button ----------
cat > src/components/pwa-controls.tsx << 'EOF'
'use client'

import { useEffect, useState } from 'react'

export default function PWAControls() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already running as PWA
    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      setIsInstalled(true)
    }
  }

  // Hide if already installed or browser doesn't support it
  if (isInstalled || !deferredPrompt) return null

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <button
        onClick={handleInstall}
        className="flex items-center gap-2 rounded-full bg-gold px-6 py-3 font-bold text-black shadow-2xl shadow-gold/20 transition-all hover:scale-105 active:scale-95"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
        نصب اپلیکیشن
      </button>
    </div>
  )
}
EOF
echo "✅ PWA button: centered at bottom"

echo "✅ update125 done!"