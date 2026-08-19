#!/bin/bash
set -e

echo "===== DIAGNOSTIC ====="
echo "1. Analytics component:"
grep -n "Analytics" src/app/layout.tsx || echo "NOT FOUND"

echo ""
echo "2. Analytics.tsx exists:"
ls -la src/components/analytics.tsx 2>/dev/null || echo "NOT FOUND"

echo ""
echo "3. /api/track exists:"
ls -la src/app/api/track/route.ts 2>/dev/null || echo "NOT FOUND"

echo ""
echo "4. PageView model:"
grep -A 3 "model PageView" prisma/schema.prisma || echo "NOT FOUND"
echo "======================"

# ---------- 1) Ultra-simple analytics component ----------
cat > src/components/analytics.tsx << 'EOF'
'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function Analytics() {
  const pathname = usePathname()

  useEffect(() => {
    // Skip admin, API, and static routes
    if (pathname.startsWith('/admin') || 
        pathname.startsWith('/api') || 
        pathname.startsWith('/_next') ||
        pathname === '/favicon.ico') {
      return
    }

    // Send pageview
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        path: pathname, 
        referrer: typeof document !== 'undefined' ? document.referrer : '' 
      }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}
EOF
echo "✅ Analytics component simplified"

# ---------- 2) Ensure /api/track exists ----------
mkdir -p src/app/api/track
cat > src/app/api/track/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const j = await req.json().catch(() => ({}))
    const path = String(j.path ?? '/').slice(0, 300)
    const referrer = String(j.referrer ?? '').slice(0, 500) || null
    const ua = (req.headers.get('user-agent') ?? '').slice(0, 300) || null
    const fwd = req.headers.get('x-forwarded-for') ?? ''
    const ip = fwd.split(',')[0]?.trim() || null
    
    await prisma.pageView.create({ 
      data: { path, referrer, ua, ip } 
    })
  } catch (err) {
    console.error('Track error:', err)
  }
  return NextResponse.json({ ok: true })
}
EOF
echo "✅ /api/track route ready"

# ---------- 3) Test tracking route ----------
mkdir -p src/app/api/debug/test-track
cat > src/app/api/debug/test-track/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Create a test pageview
  await prisma.pageView.create({
    data: {
      path: '/test-manual',
      referrer: 'manual-test',
      ua: 'test-agent',
      ip: '127.0.0.1',
    }
  })

  const count = await prisma.pageView.count()
  return NextResponse.json({ ok: true, total: count, message: 'test pageview created' })
}
EOF
echo "✅ test-track route created"

echo "✅ update176 done!"