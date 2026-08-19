#!/bin/bash
set -e

# ---------- 1) Create analytics buffer table ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'prisma/schema.prisma'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('model AnalyticsBuffer')) {
  s += '\nmodel AnalyticsBuffer {\n  id        String   @id @default(cuid())\n  path      String\n  referrer  String?\n  ua        String?\n  ip        String?\n  createdAt DateTime @default(now())\n}\n'
  fs.writeFileSync(p, s)
  console.log('✅ AnalyticsBuffer table added')
} else {
  console.log('️ already exists')
}
NODEEOF

# ---------- 2) Buffer-based tracking ----------
cat > src/components/analytics.tsx << 'EOF'
'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function Analytics() {
  const pathname = usePathname()
  const bufferRef = useRef<any[]>([])

  useEffect(() => {
    if (pathname.startsWith('/admin') || 
        pathname.startsWith('/api') || 
        pathname.startsWith('/_next') ||
        pathname === '/favicon.ico') {
      return
    }

    // Add to buffer
    bufferRef.current.push({
      path: pathname,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      ts: Date.now(),
    })

    // Flush every 10 pageviews or 30 seconds
    if (bufferRef.current.length >= 10) {
      flushBuffer()
    }
  }, [pathname])

  useEffect(() => {
    const interval = setInterval(() => {
      if (bufferRef.current.length > 0) {
        flushBuffer()
      }
    }, 30000) // 30 seconds

    // Flush on unload
    const handleUnload = () => {
      if (bufferRef.current.length > 0) {
        navigator.sendBeacon('/api/track/batch', JSON.stringify(bufferRef.current))
      }
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [])

  const flushBuffer = async () => {
    if (bufferRef.current.length === 0) return

    const batch = [...bufferRef.current]
    bufferRef.current = []

    try {
      await fetch('/api/track/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
        keepalive: true,
      })
    } catch (err) {
      console.error('Analytics batch failed:', err)
      // Re-add to buffer on failure
      bufferRef.current = [...batch, ...bufferRef.current]
    }
  }

  return null
}
EOF
echo "✅ Analytics: batch tracking"

# ---------- 3) Batch tracking API ----------
mkdir -p src/app/api/track/batch
cat > src/app/api/track/batch/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const batch = await req.json()
    if (!Array.isArray(batch) || batch.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 })
    }

    // Insert all at once
    const data = batch.map((item: any) => ({
      path: String(item.path ?? '/').slice(0, 300),
      referrer: String(item.referrer ?? '').slice(0, 500) || null,
      ua: '',
      ip: '',
    }))

    await prisma.pageView.createMany({ data })
    return NextResponse.json({ ok: true, inserted: data.length })
  } catch (err) {
    console.error('Batch track error:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
EOF
echo "✅ Batch tracking API"

echo "✅ update180 done!"