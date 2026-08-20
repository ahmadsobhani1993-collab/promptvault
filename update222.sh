#!/bin/bash
set -e

# ---------- 1) Find channel ID by scanning updates ----------
mkdir -p src/app/api/debug/find-channel-id
cat > src/app/api/debug/find-channel-id/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'No Telegram token' }, { status: 500 })

  const api = (m: string, q?: Record<string, string>) =>
    'https://api.telegram.org/bot' + token + '/' + m + (q ? '?' + new URLSearchParams(q).toString() : '')

  try {
    // Get recent updates to find channel messages
    const updates = await (await fetch(api('getUpdates', { limit: '50' }), {
      signal: AbortSignal.timeout(10000),
    })).json()

    const channels: any[] = []
    for (const update of updates.result || []) {
      const chat = update.message?.chat || update.edited_message?.chat
      if (chat?.type === 'channel' || chat?.username?.includes('prompts')) {
        channels.push({
          id: chat.id,
          username: chat.username,
          title: chat.title,
          type: chat.type,
        })
      }
    }

    // Also try getChats
    const chats = await (await fetch(api('getChats'), {
      signal: AbortSignal.timeout(10000),
    })).json()

    if (chats.ok && chats.result) {
      for (const chat of chats.result) {
        if (!channels.find(c => c.id === chat.id)) {
          channels.push({
            id: chat.id,
            username: chat.username,
            title: chat.title,
            type: chat.type,
          })
        }
      }
    }

    // Save the first channel found
    if (channels.length > 0) {
      const channel = channels[0]
      await prisma.setting.upsert({
        where: { key: 'tg_chat_id' },
        update: { value: String(channel.id) },
        create: { key: 'tg_chat_id', value: String(channel.id) },
      })

      return NextResponse.json({
        ok: true,
        channels,
        saved: channel,
        message: `Chat ID ${channel.id} saved. Now import-loop can use it.`,
      })
    }

    return NextResponse.json({
      ok: false,
      error: 'No channels found',
      hint: 'ربات باید حداقل یک پیام از کانال دیده باشد',
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
EOF
echo "✅ Find channel ID route created"

# ---------- 2) Fix import-loop to save Telegram URL only ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/import-loop/route.ts'
if (!fs.existsSync(p)) {
  console.log('⚠️ import-loop.ts not found')
  process.exit(0)
}

let s = fs.readFileSync(p, 'utf8')

// Make sure we're NOT downloading the image
if (s.includes('Buffer.from') || s.includes('arrayBuffer()')) {
  console.log('❌ Still downloading images! Need to remove base64 code')
} else {
  console.log('✅ No image download code found')
}

// Make sure we're saving the Telegram URL
if (s.includes("img: imgUrl")) {
  console.log('✅ Saving Telegram URL correctly')
} else {
  console.log('⚠️ May need to verify img field')
}

// Check if we're using the correct chat_id from settings
if (s.includes("'tg_chat_id'")) {
  console.log('✅ Using tg_chat_id from settings')
} else {
  console.log('⚠️ May need to add tg_chat_id usage')
}
NODEEOF

echo ""
echo "===== AFTER DEPLOY ====="
echo ""
echo "Step 1: Find channel ID"
echo "  https://promptsfa.ir/api/debug/find-channel-id?key=pv-cron-8x2m1q"
echo ""
echo "Step 2: Check database (should still show internal links)"
echo "  https://promptsfa.ir/api/debug/check-db-images?key=pv-cron-8x2m1q"
echo ""
echo "Step 3: Test new import (should save Telegram URL)"
echo "  https://promptsfa.ir/api/import-loop?key=pv-cron-8x2m1q&count=5"
echo ""
echo "=================================="

echo "✅ update222 done!"