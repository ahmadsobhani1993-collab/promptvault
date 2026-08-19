#!/bin/bash
set -e

# ---------- 1) Add Bookmark model to schema ----------
node << 'NODEEOF'
const fs = require('fs')
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8')

if (!schema.includes('model Bookmark')) {
  let newSchema = schema + `

model Bookmark {
  id        String   @id @default(cuid())
  userId    String
  promptId  String
  createdAt DateTime @default(now())
  
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  prompt Prompt @relation(fields: [promptId], references: [id], onDelete: Cascade)
  
  @@unique([userId, promptId])
}
`
  fs.writeFileSync('prisma/schema.prisma', newSchema)
  console.log('✅ Bookmark model added to schema')
} else {
  console.log('⚠️ Bookmark already exists')
}
NODEEOF

# ---------- 2) Fix homepage: find correct structure ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/page.tsx'
if (!fs.existsSync(p)) {
  console.log('❌ Homepage not found')
  process.exit(0)
}

let s = fs.readFileSync(p, 'utf8')

// Check if there's an articles section
if (s.includes('article') || s.includes('Article')) {
  console.log('✅ Found articles in homepage')
  
  // Try different patterns to limit articles
  const patterns = [
    // Pattern 1: prisma.article.findMany
    { find: /prisma\.article\.findMany\(\{/g, replace: 'prisma.article.findMany({ take: 6, ' },
    // Pattern 2: articles.map or similar
    { find: /\.map\(\(article/g, replace: '.slice(0, 6).map((article' },
  ]
  
  for (const pattern of patterns) {
    if (pattern.find.test(s)) {
      s = s.replace(pattern.find, pattern.replace)
      console.log('✅ Applied pattern:', pattern.replace)
      break
    }
  }
  
  // Add "View More" button if not exists
  if (!s.includes('/blog') || !s.includes('مشاهده')) {
    // Find the end of main content and add button
    s = s.replace(
      /(<\/main>)/,
      `<div className="container-app pb-16 text-center">
        <a href="/blog" className="inline-flex items-center rounded-full bg-gold px-6 py-3 font-bold text-black transition-all hover:scale-105">
          مشاهده همه مقالات
        </a>
      </div>
      </main>`
    )
    console.log('✅ "View More" button added')
  }
  
  fs.writeFileSync(p, s)
} else {
  console.log('❌ No articles found in homepage - showing file structure:')
  console.log(s.slice(0, 1000))
}
NODEEOF

# ---------- 3) Force PWA button visibility check ----------
cat > src/components/pwa-controls.tsx << 'EOF'
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
EOF
echo "✅ PWA button: added debug logs"

# ---------- 4) Run prisma generate and push ----------
echo "Running prisma migrations..."
npx prisma generate
npx prisma db push

echo "✅ update141 done!"