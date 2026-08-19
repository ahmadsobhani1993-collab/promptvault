#!/bin/bash
set -e

# ---------- 1) Fix layout.tsx to actually mount Analytics and PWAControls ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/layout.tsx'
let s = fs.readFileSync(p, 'utf8')

// Ensure imports are there
if (!s.includes("import Analytics from '@/components/analytics'")) {
  s = s.replace(
    "import JsonLd from '@/components/json-ld'",
    "import JsonLd from '@/components/json-ld'\nimport Analytics from '@/components/analytics'\nimport PWAControls from '@/components/pwa-controls'"
  )
}

// Mount them inside the body, right before ClientProviders
if (!s.includes('<Analytics />')) {
  s = s.replace(
    '<ClientProviders />',
    '<Analytics />\n        <PWAControls />\n        <ClientProviders />'
  )
}

fs.writeFileSync(p, s)
console.log('✅ Analytics and PWAControls explicitly mounted in body')
NODEEOF

# ---------- 2) Add console.log to Analytics to verify it runs ----------
cat > src/components/analytics.tsx << 'EOF'
'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function Analytics() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname.startsWith('/admin') || 
        pathname.startsWith('/api') || 
        pathname.startsWith('/_next') ||
        pathname === '/favicon.ico') {
      return
    }

    console.log('[Analytics] Tracking pageview:', pathname)

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        path: pathname, 
        referrer: typeof document !== 'undefined' ? document.referrer : '' 
      }),
      keepalive: true,
    })
    .then(res => res.json())
    .then(data => console.log('[Analytics] Tracked successfully:', data))
    .catch(err => console.error('[Analytics] Track failed:', err))
  }, [pathname])

  return null
}
EOF
echo "✅ Analytics component: added console logs for debugging"

echo "✅ update177 done!"