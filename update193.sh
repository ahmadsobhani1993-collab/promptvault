#!/bin/bash
set -e

# ---------- 1) Create chat-id debug route ----------
mkdir -p src/app/api/debug/chat-id
cat > src/app/api/debug/chat-id/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })

  try {
    const updates = await (await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?limit=50`,
      { signal: AbortSignal.timeout(10000) }
    )).json()

    const chats: any[] = []
    for (const u of updates.result || []) {
      if (u.message?.chat) {
        chats.push({
          id: u.message.chat.id,
          type: u.message.chat.type,
          username: u.message.chat.username,
          title: u.message.chat.title,
          lastMessage: u.message.text?.slice(0, 50),
        })
      }
    }

    // Save the first private chat
    const privateChat = chats.find(c => c.type === 'private')
    if (privateChat) {
      await prisma.setting.upsert({
        where: { key: 'tg_private_chat' },
        update: { value: String(privateChat.id) },
        create: { key: 'tg_private_chat', value: String(privateChat.id) },
      })
    }

    return NextResponse.json({
      ok: true,
      chats,
      savedPrivateChat: privateChat?.id || null,
      hint: 'اگر می‌خواهید chat_id ذخیره شود، اول به ربات تلگرام پیام /start بفرستید',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
EOF
echo "✅ Chat ID debug route created"

# ---------- 2) Fix article images: check for broken telegram URLs ----------
mkdir -p src/app/api/debug/fix-images
cat > src/app/api/debug/fix-images/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const articles = await prisma.article.findMany({
    select: { id: true, titleFa: true, img: true },
  })

  const broken: any[] = []
  const fixed: any[] = []

  for (const a of articles) {
    // Check if image URL is broken
    if (!a.img || a.img.includes('undefined') || a.img.includes('null')) {
      broken.push({ id: a.id, title: a.titleFa, img: a.img })
      continue
    }

    // Try to fetch the image
    try {
      const res = await fetch(a.img, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
      if (!res.ok) {
        broken.push({ id: a.id, title: a.titleFa, img: a.img, status: res.status })
      }
    } catch (err: any) {
      broken.push({ id: a.id, title: a.titleFa, img: a.img, error: err.message })
    }
  }

  return NextResponse.json({
    ok: true,
    total: articles.length,
    brokenCount: broken.length,
    broken: broken.slice(0, 10), // Show first 10
    hint: 'برای مقالات با عکس شکسته، باید عکس جدید آپلود کنید یا لینک را اصلاح کنید',
  })
}
EOF
echo "✅ Fix images debug route created"

# ---------- 3) Disable notifications polling (if it's causing issues) ----------
node << 'NODEEOF'
const fs = require('fs')

// Check if there's a notification polling component
const files = [
  'src/components/notif-bell.tsx',
  'src/components/notification-bell.tsx',
  'src/app/api/notifications/route.ts',
]

for (const f of files) {
  if (fs.existsSync(f)) {
    console.log('Found:', f)
    const s = fs.readFileSync(f, 'utf8')
    
    // Check for polling interval
    if (s.includes('setInterval') || s.includes('poll')) {
      console.log('  ⚠️ Has polling - checking interval...')
      const match = s.match(/setInterval\([^,]+,\s*(\d+)/)
      if (match) {
        const interval = parseInt(match[1])
        console.log(`  Polling interval: ${interval}ms (${interval/1000}s)`)
        if (interval < 30000) {
          console.log('  ⚠️ Interval is too short - should be at least 30000ms')
        }
      }
    }
  }
}
NODEEOF

echo ""
echo "===== NEXT STEPS ====="
echo "1. Get chat ID:"
echo "   https://promptsfa.ir/api/debug/chat-id?key=pv-cron-8x2m1q"
echo ""
echo "2. Check broken article images:"
echo "   https://promptsfa.ir/api/debug/fix-images?key=pv-cron-8x2m1q"
echo ""
echo "3. For broken images, use the upload button in /admin/articles/[id]/edit"
echo "======================"

echo "✅ update193 done!"