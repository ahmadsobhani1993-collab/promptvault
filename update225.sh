#!/bin/bash
set -e

# ---------- 1) Reset import range to match actual channel ----------
mkdir -p src/app/api/debug/reset-import-range
cat > src/app/api/debug/reset-import-range/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startId = parseInt(searchParams.get('start') || '1')
  const endId = parseInt(searchParams.get('end') || '1900') // Last message is 1884

  // Reset cursor and stop
  await prisma.setting.upsert({
    where: { key: 'import_cursor' },
    update: { value: String(startId) },
    create: { key: 'import_cursor', value: String(startId) }
  })

  await prisma.setting.upsert({
    where: { key: 'import_stop' },
    update: { value: String(endId) },
    create: { key: 'import_stop', value: String(endId) }
  })

  // Get current total prompts
  const totalPrompts = await prisma.prompt.count()

  return NextResponse.json({
    ok: true,
    message: `Import range reset: ${startId} to ${endId}`,
    range: { start: startId, end: endId, totalMessages: endId - startId + 1 },
    currentTotalPrompts: totalPrompts,
    estimatedNetworkMB: ((endId - startId) * 0.002).toFixed(2), // ~2KB per message
    nextStep: `Now run: /api/import-loop?count=50 to start importing from message ${startId}`,
  })
}
EOF
echo "✅ Import range reset route created"

# ---------- 2) Scan channel to find actual message range ----------
mkdir -p src/app/api/debug/scan-channel-range
cat > src/app/api/debug/scan-channel-range/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 500 })

  const api = (m: string, q?: Record<string, string>) =>
    'https://api.telegram.org/bot' + token + '/' + m + (q ? '?' + new URLSearchParams(q).toString() : '')

  const chatId = await (await prisma.setting.findUnique({ where: { key: 'tg_chat_id' } }))?.value
  if (!chatId) {
    return NextResponse.json({ error: 'tg_chat_id not set' }, { status: 500 })
  }

  try {
    // Get channel info to find message count
    const chatRes = await fetch(api('getChat', { chat_id: chatId }), {
      signal: AbortSignal.timeout(10000),
    })
    const chatData = await chatRes.json()

    if (!chatData.ok) {
      return NextResponse.json({
        ok: false,
        error: chatData.description,
        hint: 'ربات باید ادمین کانال باشد',
      })
    }

    const channel = chatData.result
    
    // Try to get last message by forwarding message 999999 (will fail but tell us the max)
    // For now, just return channel info
    return NextResponse.json({
      ok: true,
      channel: {
        id: channel.id,
        title: channel.title,
        type: channel.type,
        username: channel.username,
      },
      info: {
        lastMessageId: '1884 (based on your observation)',
        estimatedPrompts: '~1000-1500 (some messages are not prompts)',
      },
      recommendation: {
        startFrom: 1,
        stopAt: 1900,
        estimatedNetworkMB: '3.8 MB (1900 messages × 2KB)',
      },
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
EOF
echo "✅ Channel scan route created"

echo ""
echo "===== STEP-BY-STEP PLAN ====="
echo ""
echo "Step 1: Scan channel info"
echo "  https://promptsfa.ir/api/debug/scan-channel-range?key=pv-cron-8x2m1q"
echo ""
echo "Step 2: Reset import range (1 to 1900)"
echo "  https://promptsfa.ir/api/debug/reset-import-range?key=pv-cron-8x2m1q&start=1&end=1900"
echo ""
echo "Step 3: Test import 50 prompts"
echo "  https://promptsfa.ir/api/import-loop?key=pv-cron-8x2m1q&count=50"
echo ""
echo "Step 4: Check database for Telegram links"
echo "  https://promptsfa.ir/api/debug/check-db-images?key=pv-cron-8x2m1q"
echo "======================================"

echo "✅ update225 done!"