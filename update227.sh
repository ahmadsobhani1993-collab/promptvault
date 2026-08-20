#!/bin/bash
set -e

mkdir -p src/app/api/debug/find-next-gap
cat > src/app/api/debug/find-next-gap/route.ts << 'EOF'
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
  const priv = await (await prisma.setting.findUnique({ where: { key: 'tg_private_chat' } }))?.value

  if (!chatId || !priv) return NextResponse.json({ error: 'Chat IDs not set' }, { status: 500 })

  // 1. Find the HIGHEST tg- ID currently in the database
  const allTgPrompts = await prisma.prompt.findMany({
    where: { slug: { startsWith: 'tg-' } },
    select: { slug: true },
  })

  let maxId = 0
  for (const p of allTgPrompts) {
    const idStr = p.slug.replace('tg-', '')
    const id = parseInt(idStr)
    if (!isNaN(id) && id > maxId) {
      maxId = id
    }
  }

  const startSearch = maxId > 0 ? maxId + 1 : 1
  const maxChannelId = 1884 // Based on your observation

  if (startSearch > maxChannelId) {
    return NextResponse.json({
      ok: true,
      message: 'شما به انتهای کانال رسیده‌اید! تمام پیام‌های موجود ایمپورت شده‌اند.',
      maxIdInDb: maxId,
    })
  }

  // 2. Scan forward from the highest existing ID to find the first VALID missing message
  let foundMessage: any = null
  const scanLog: string[] = []
  let checkedCount = 0

  for (let i = startSearch; i <= maxChannelId && checkedCount < 200; i++) {
    checkedCount++
    
    // Check if already in DB
    const exists = await prisma.prompt.findUnique({ where: { slug: 'tg-' + i } })
    if (exists) {
      if (checkedCount <= 10) scanLog.push(`[${i}] Skip: Already in DB`)
      continue
    }

    // Try to forward
    const f1 = await (await fetch(api('forwardMessage', { chat_id: priv, from_chat_id: chatId, message_id: String(i) }), { signal: AbortSignal.timeout(5000) })).json()
    if (!f1.ok) {
      if (checkedCount <= 10) scanLog.push(`[${i}] Skip: Forward failed`)
      continue
    }

    const m1 = f1.result
    const hasPhoto = !!m1.photo?.length
    const text = (m1.caption || m1.text || '').trim()
    const hasText = text.length > 20
    const isReply = !!m1.reply_to_message

    // Check if it's a valid prompt
    if (hasPhoto && (hasText || isReply)) {
      foundMessage = {
        messageId: i,
        hasPhoto: true,
        textPreview: text.slice(0, 80) + (text.length > 80 ? '...' : ''),
        isReply: isReply,
      }
      // Cleanup
      await fetch(api('deleteMessage', { chat_id: priv, message_id: String(m1.message_id) })).catch(() => {})
      break // STOP! We found the next valid one.
    } else {
      if (checkedCount <= 10) scanLog.push(`[${i}] Skip: No photo/text`)
      // Cleanup
      await fetch(api('deleteMessage', { chat_id: priv, message_id: String(m1.message_id) })).catch(() => {})
    }
  }

  if (foundMessage) {
    return NextResponse.json({
      ok: true,
      found: true,
      highestIdInDb: maxId,
      nextValidMessage: foundMessage.messageId,
      message: foundMessage,
      action: `تنظیم import_cursor روی ${foundMessage.messageId} و ادامه ایمپورت`,
    })
  }

  return NextResponse.json({
    ok: true,
    found: false,
    highestIdInDb: maxId,
    checkedUpTo: startSearch + checkedCount - 1,
    scanLog: scanLog,
    hint: 'در ۲۰۰ پیام بعدی، پیام معتبر جدیدی یافت نشد. احتمالاً همه پرامپت‌های کانال قبلاً ایمپورت شده‌اند.',
  })
}
EOF
echo "✅ Next gap finder created"

echo ""
echo "===== AFTER DEPLOY ====="
echo "This tool will find the EXACT message ID to resume from:"
echo "  https://promptsfa.ir/api/debug/find-next-gap?key=pv-cron-8x2m1q"
echo "=================================="

echo "✅ update227 done!"