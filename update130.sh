#!/bin/bash
set -e

# ---------- 1) PWA button: back but smaller, bottom-right ----------
cat > src/components/pwa-controls.tsx << 'EOF'
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
    } else {
      alert('📲 برای نصب:\n\n• Chrome موبایل: منوی سه‌نقطه → "Add to Home Screen"\n• Safari iOS: Share → "Add to Home Screen"\n• Chrome دسکتاپ: آیکون install در نوار آدرس')
    }
  }

  if (isInstalled || !deferredPrompt) return null

  return (
    <button
      onClick={handleInstall}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-1 rounded-full bg-gold/90 px-3 py-1.5 text-[10px] font-bold text-black shadow-lg transition-all hover:scale-105 active:scale-95 md:bottom-6 md:right-6 md:px-4 md:py-2 md:text-xs"
      title="نصب اپلیکیشن"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3 md:h-4 md:w-4">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      <span className="hidden sm:inline">نصب اپ</span>
    </button>
  )
}
EOF
echo "✅ PWA button: bottom-right, small"

# ---------- 2) Fix article-form: add useRef import ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/article-form.tsx'
let s = fs.readFileSync(p, 'utf8')

// Add useRef to import
if (!s.includes('useRef')) {
  s = s.replace(
    "import { useRouter } from 'next/navigation'",
    "import { useRouter } from 'next/navigation'\nimport { useRef, useState } from 'react'"
  )
  // Remove duplicate useState import if exists
  s = s.replace(/import \{ useState \} from 'react'\n/, '')
  fs.writeFileSync(p, s)
  console.log('✅ Article form: useRef imported')
} else {
  console.log('⚠️ useRef already imported')
}
NODEEOF

echo "✅ update130 done!"