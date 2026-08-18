#!/bin/bash
set -e

# ---------- 1) PWA button: always visible with fallback ----------
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
      // Fallback: show manual install instructions
      alert('برای نصب اپلیکیشن:\n\n' +
        '📱 در موبایل:\n' +
        '• Chrome: منوی سه‌نقطه → "Add to Home Screen"\n' +
        '• Safari: دکمه Share → "Add to Home Screen"\n\n' +
        '💻 در دسکتاپ:\n' +
        '• Chrome: آیکون نصب در نوار آدرس\n' +
        '• Edge: منوی سه‌نقطه → "Apps" → "Install this site"')
    }
  }

  if (isInstalled) return null

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
echo "✅ PWA button: always visible with fallback"

# ---------- 2) Instagram webhook for third-party services ----------
mkdir -p src/app/api/webhook/instagram
cat > src/app/api/webhook/instagram/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendToInstagramCustom } from '@/lib/instagram'

// Webhook for Buffer, Later, n8n, Zapier, IFTTT, etc.
// POST with { slug, caption? } or { promptId, caption? }
export async function POST(req: Request) {
  try {
    const j = await req.json()
    const { slug, promptId, caption } = j

    let p: any = null
    if (slug) p = await prisma.prompt.findUnique({ where: { slug } })
    else if (promptId) p = await prisma.prompt.findUnique({ where: { id: promptId } })

    if (!p) return NextResponse.json({ error: 'prompt not found' }, { status: 404 })

    const defaultCaption = (p.tagsFa ?? []).map((t: string) => '#' + t.replace(/\s+/g, '_')).join(' ') +
      '\n\nبرای دریافت پرامپت‌های بیشتر به سایت ما مراجعه کنید\n' +
      'برای دریافت این پرامپت ابتدا ما را فالو کرده و سپس کلمه PROMPT را ارسال کنید.'

    const result = await sendToInstagramCustom(p, caption ?? defaultCaption)
    return NextResponse.json({ ok: true, result })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 })
  }
}
EOF
echo "✅ Instagram webhook created"

echo "✅ update126 done!"