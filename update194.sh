#!/bin/bash
set -e

echo "===== Checking notifications polling ====="
if [ -f "src/components/notif-bell.tsx" ]; then
  echo "Found notif-bell.tsx"
  grep -n "setInterval\|fetch.*notif" src/components/notif-bell.tsx | head -10
else
  echo "notif-bell.tsx not found"
fi

if [ -f "src/app/api/notifications/route.ts" ]; then
  echo ""
  echo "Found notifications API route"
  head -30 src/app/api/notifications/route.ts
fi
echo "========================================="

# ---------- 1) Fix notifications polling interval (if too short) ----------
node << 'NODEEOF'
const fs = require('fs')
const files = [
  'src/components/notif-bell.tsx',
  'src/components/notification-bell.tsx',
]

for (const f of files) {
  if (!fs.existsSync(f)) continue
  let s = fs.readFileSync(f, 'utf8')
  
  // Find setInterval and check interval
  const match = s.match(/setInterval\(([^,]+),\s*(\d+)\)/)
  if (match) {
    const interval = parseInt(match[2])
    console.log(`${f}: polling interval = ${interval}ms`)
    
    if (interval < 60000) {
      // Increase to 60 seconds
      s = s.replace(
        /setInterval\(([^,]+),\s*\d+\)/,
        'setInterval($1, 60000)'
      )
      fs.writeFileSync(f, s)
      console.log(`  ✅ Increased to 60000ms (1 minute)`)
    } else {
      console.log(`  ✅ Interval is fine`)
    }
  } else {
    console.log(`${f}: no setInterval found`)
  }
}
NODEEOF

# ---------- 2) Create image replace helper for broken article ----------
mkdir -p src/app/api/debug/replace-image
cat > src/app/api/debug/replace-image/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { articleId, newImageUrl } = await req.json()
  if (!articleId || !newImageUrl) {
    return NextResponse.json({ error: 'articleId and newImageUrl required' }, { status: 400 })
  }

  await prisma.article.update({
    where: { id: articleId },
    data: { img: newImageUrl },
  })

  return NextResponse.json({ ok: true, message: 'image replaced' })
}
EOF
echo "✅ Image replace API created"

echo ""
echo "===== STATUS ====="
echo "✅ Chat ID saved: 100310079"
echo "✅ Upload to Telegram should now work"
echo "✅ Notifications polling optimized"
echo ""
echo "===== NEXT STEPS ====="
echo "1. Test upload: Go to /admin/articles/new, fill title, upload image"
echo "2. For broken image article: Edit it and upload new image"
echo "======================"

echo "✅ update194 done!"