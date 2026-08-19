#!/bin/bash
set -e

# ---------- 1) Debug route for analytics ----------
mkdir -p src/app/api/debug/analytics
cat > src/app/api/debug/analytics/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const [total, today, schema] = await Promise.all([
    prisma.pageView.count(),
    prisma.pageView.count({
      where: {
        createdAt: {
          gte: new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date()) + 'T00:00:00+03:30')
        }
      }
    }),
    prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'PageView'`
  ])

  return NextResponse.json({
    ok: true,
    total,
    today,
    schema: JSON.parse(JSON.stringify(schema))
  })
}
EOF
echo "✅ analytics debug route"

# ---------- 2) Fix logout link in header ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/layout/header.tsx'
let s = fs.readFileSync(p, 'utf8')

// Check if there's a /logout link
if (s.includes('/logout')) {
  // Replace with proper sign out
  s = s.replace(
    /href="\/logout"/,
    'href="#" onClick={(e) => { e.preventDefault(); fetch("/api/auth/signout", { method: "POST" }).then(() => window.location.href = "/") } }'
  )
  console.log('✅ logout link fixed')
} else {
  console.log('⚠️ no /logout link found')
}

fs.writeFileSync(p, s)
NODEEOF

# ---------- 3) Ensure analytics component is mounted ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/layout.tsx'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('Analytics')) {
  s = s.replace(
    "import JsonLd from '@/components/json-ld'",
    "import JsonLd from '@/components/json-ld'\nimport Analytics from '@/components/analytics'"
  )
  s = s.replace('<RouteLoader />', '<RouteLoader />\n        <Analytics />')
  fs.writeFileSync(p, s)
  console.log('✅ Analytics mounted in layout')
} else {
  console.log('⚠️ Analytics already mounted')
}
NODEEOF

# ---------- 4) Fix analytics component to handle errors ----------
cat > src/components/analytics.tsx << 'EOF'
'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function Analytics() {
  const pathname = usePathname()

  useEffect(() => {
    // Skip admin and API routes
    if (pathname.startsWith('/admin') || pathname.startsWith('/api')) return

    const send = async () => {
      try {
        await fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            path: pathname, 
            referrer: typeof document !== 'undefined' ? document.referrer : '' 
          }),
          keepalive: true,
        })
      } catch (err) {
        // Silently fail
      }
    }

    send()
  }, [pathname])

  return null
}
EOF
echo "✅ Analytics component: skip admin/api routes"

echo "✅ update136 done!"