#!/bin/bash
set -e

# ---------- 1) Smart scanner: finds importable messages without importing ----------
mkdir -p src/app/api/debug/smart-scan
cat > src/app/api/debug/smart-scan/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startId = parseInt(searchParams.get('start') || '1')
  const endId = parseInt(searchParams.get('end') || '3660')
  const sampleSize = parseInt(searchParams.get('sample') || '50')

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })
  
  const api = (m: string, q?: Record<string, string>) =>
    'https://api.telegram.org/bot' + token + '/' + m + (q ? '?' + new URLSearchParams(q).toString() : '')

  // Get already imported IDs
  const existingPrompts = await prisma.prompt.findMany({
    where: { slug: { startsWith: 'tg-' } },
    select: { slug: true },
  })
  
  const importedIds = new Set(
    existingPrompts.map(p => {
      const idStr = p.slug.replace('tg-', '')
      const id = parseInt(idStr)
      return isNaN(id) ? null : id
    }).filter(Boolean) as number[]
  )

  // Get chat IDs
  let chatId = (await prisma.setting.findUnique({ where: { key: 'tg_chat_id' } }))?.value ?? ''
  let priv = (await prisma.setting.findUnique({ where: { key: 'tg_private_chat' } }))?.value ?? ''

  if (!chatId || !priv) {
    return NextResponse.json({ error: 'chat IDs not configured' }, { status: 500 })
  }

  // Scan a sample of messages
  const scanResults: any[] = []
  const step = Math.max(1, Math.floor((endId - startId) / sampleSize))
  
  let hasPhoto = 0
  let hasText = 0
  let both = 0
  let reply = 0
  let importable = 0

  for (let id = startId; id <= endId && scanResults.length < sampleSize; id += step) {
    if (importedIds.has(id)) continue

    try {
      // Forward message to private chat
      const f1 = await (await fetch(api('forwardMessage', { 
        chat_id: priv, 
        from_chat_id: chatId, 
        message_id: String(id) 
      }), { signal: AbortSignal.timeout(5000) })).json()

      if (!f1.ok) continue

      const m1 = f1.result
      const hasPhotoField = !!m1.photo?.length
      const text = (m1.caption || m1.text || '').trim()
      const hasTextField = text.length > 10
      const isReply = !!m1.reply_to_message

      if (hasPhotoField) hasPhoto++
      if (hasTextField) hasText++
      if (hasPhotoField && hasTextField) both++
      if (isReply) reply++

      // Check if importable (has photo and text, or photo with reply)
      if (hasPhotoField && (hasTextField || isReply)) {
        importable++
      }

      scanResults.push({
        id,
        hasPhoto: hasPhotoField,
        hasText: hasTextField,
        textLength: text.length,
        isReply,
        importable: hasPhotoField && (hasTextField || isReply),
      })

      // Delete forwarded message to keep private chat clean
      await fetch(api('deleteMessage', { 
        chat_id: priv, 
        message_id: String(m1.message_id) 
      })).catch(() => {})

    } catch (err) {
      // Skip on error
    }
  }

  // Estimate total importable
  const totalScanned = scanResults.length
  const importablePercentage = totalScanned > 0 ? (importable / totalScanned) : 0
  const estimatedTotalImportable = Math.floor((endId - startId - importedIds.size) * importablePercentage)

  // Calculate network cost
  const messagesToScan = endId - startId - importedIds.size
  const estimatedNetworkMB = (messagesToScan * 500 / 1024 / 1024).toFixed(2)

  return NextResponse.json({
    ok: true,
    scan: {
      sampleSize: totalScanned,
      hasPhoto,
      hasText,
      both,
      reply,
      importable,
      importablePercentage: (importablePercentage * 100).toFixed(1) + '%',
    },
    estimate: {
      totalMessagesToScan: messagesToScan,
      estimatedImportable: estimatedTotalImportable,
      estimatedNetworkMB,
      yourRemainingQuota: '600 MB',
      safe: parseFloat(estimatedNetworkMB) < 600,
    },
    sample: scanResults.slice(0, 10),
    nextStep: estimatedTotalImportable > 0 
      ? `برای ایمپورت ~${estimatedTotalImportable} پرامپت جدید، import-loop را اجرا کنید`
      : 'هیچ پرامپت جدیدی برای ایمپورت یافت نشد',
  })
}
EOF
echo "✅ Smart scanner created"

# ---------- 2) Network usage tracker (internal) ----------
mkdir -p src/app/api/debug/network-tracker
cat > src/app/api/debug/network-tracker/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || 'status'

  if (action === 'reset') {
    await prisma.setting.upsert({
      where: { key: 'network_tracker_start' },
      update: { value: new Date().toISOString() },
      create: { key: 'network_tracker_start', value: new Date().toISOString() }
    })
    await prisma.setting.upsert({
      where: { key: 'network_tracker_api_calls' },
      update: { value: '0' },
      create: { key: 'network_tracker_api_calls', value: '0' }
    })
    return NextResponse.json({ ok: true, message: 'Tracker reset' })
  }

  if (action === 'log') {
    const calls = parseInt((await prisma.setting.findUnique({ where: { key: 'network_tracker_api_calls' } }))?.value || '0')
    await prisma.setting.upsert({
      where: { key: 'network_tracker_api_calls' },
      update: { value: String(calls + 1) },
      create: { key: 'network_tracker_api_calls', value: String(calls + 1) }
    })
    return NextResponse.json({ ok: true, calls: calls + 1 })
  }

  // Default: show status
  const startTime = (await prisma.setting.findUnique({ where: { key: 'network_tracker_start' } }))?.value
  const apiCalls = (await prisma.setting.findUnique({ where: { key: 'network_tracker_api_calls' } }))?.value || '0'
  
  const totalPrompts = await prisma.prompt.count()
  const lastHour = await prisma.prompt.count({
    where: { createdAt: { gte: new Date(Date.now() - 3600000) } }
  })

  return NextResponse.json({
    ok: true,
    tracker: {
      startTime: startTime || 'not set',
      apiCallsSinceReset: parseInt(apiCalls),
      estimatedNetworkMB: (parseInt(apiCalls) * 0.0005).toFixed(3), // ~0.5KB per API call
    },
    database: {
      totalPrompts,
      newPromptsLastHour: lastHour,
    },
    neonDashboard: {
      message: 'برای دیدن Network Transfer واقعی، به صفحه Overview داشبورد Neon بروید (نه Monitoring)',
      url: 'https://console.neon.tech/app/projects',
      note: 'Network Transfer در بخش Overview > Usage نمایش داده می‌شود',
    },
  })
}
EOF
echo "✅ Network tracker created"

# ---------- 3) Update import-loop to handle replies ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/import-loop/route.ts'
let s = fs.readFileSync(p, 'utf8')

// Enhance the text pairing logic to check up to 5 messages and handle replies
if (!s.includes('for (let off = 1; off <= 5; off++)')) {
  s = s.replace(
    /for \(let off = 1; off <= 3; off\+\+\)/,
    'for (let off = 1; off <= 5; off++)'
  )
  console.log('✅ Extended message pairing to 5 messages')
}

// Add reply checking
if (!s.includes('reply_to_message')) {
  const replyCheck = `
    // Check if this is a reply to a previous message with photo
    if (!fileId && m1.reply_to_message?.photo?.length) {
      const replyPhoto = m1.reply_to_message.photo[m1.reply_to_message.photo.length - 1]
      const replyFileRes = await (await fetch(api('getFile', { file_id: replyPhoto.file_id }), { signal: AbortSignal.timeout(10000) })).json()
      if (replyFileRes.result?.file_path) {
        imgUrl = 'https://api.telegram.org/file/bot' + token + '/' + replyFileRes.result.file_path
        fileId = replyPhoto.file_id
        debug.push('  using reply photo')
      }
    }
`
  s = s.replace(
    /if \(!imgUrl\) \{[\s\S]*?cursor \+= advanced[\s\S]*?continue[\s\S]*?\}/,
    `if (!imgUrl) {
      ${replyCheck}
      if (!imgUrl) {
        debug.push('  skip: file_path not found')
        cursor += advanced
        continue
      }
    }`
  )
  console.log('✅ Added reply photo handling')
}

fs.writeFileSync(p, s)
NODEEOF

echo ""
echo "===== AFTER DEPLOY ====="
echo ""
echo "Step 1: Smart scan (checks 50 sample messages from 1-3660)"
echo "  https://promptsfa.ir/api/debug/smart-scan?key=pv-cron-8x2m1q&start=1&end=3660&sample=50"
echo ""
echo "Step 2: If scan shows importable messages, run import-loop"
echo "  https://promptsfa.ir/api/import-loop?key=pv-cron-8x2m1q&count=10"
echo ""
echo "Step 3: Monitor network usage"
echo "  https://promptsfa.ir/api/debug/network-tracker?key=pv-cron-8x2m1q"
echo ""
echo "=================================="

echo "✅ update214 done!"