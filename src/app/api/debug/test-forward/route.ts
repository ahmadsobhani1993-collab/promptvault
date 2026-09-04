import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const q = new URL(req.url).searchParams
  const msgId = parseInt(q.get('msgId') || '689', 10)

  const token = process.env.TELEGRAM_BOT_TOKEN!
  const channelId = '-1003790089817'

  // 1. چک has_protected_content دقیق
  const chatInfo = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${channelId}`).then(r => r.json())

  // 2. پیدا کردن private chat برای forward
  const privChat = (await prisma.setting.findUnique({ where: { key: 'tg_private_chat' } }))?.value
  if (!privChat) return NextResponse.json({ error: 'no private chat set' }, { status: 500 })

  // 3. تست forwardMessage روی msgId مشخص
  const fwd = await fetch(
    `https://api.telegram.org/bot${token}/forwardMessage?chat_id=${privChat}&from_chat_id=${channelId}&message_id=${msgId}`
  ).then(r => r.json())

  // 4. اگر موفق بود، پیام را پاک کن
  if (fwd.ok && fwd.result?.message_id) {
    await fetch(
      `https://api.telegram.org/bot${token}/deleteMessage?chat_id=${privChat}&message_id=${fwd.result.message_id}`
    ).catch(() => {})
  }

  return NextResponse.json({
    ok: true,
    msgId,
    chat_info: {
      has_protected_content: chatInfo.result?.has_protected_content,
      has_hidden_members: chatInfo.result?.has_hidden_members,
      has_aggressive_anti_spam: chatInfo.result?.has_aggressive_anti_spam,
    },
    forward_result: fwd,
    diagnosis: fwd.ok
      ? '✅ forwardMessage کار کرد — مشکل از جای دیگری است'
      : fwd.description?.includes("can't be forwarded")
      ? '⚠️ Restrict saving content فعال است'
      : fwd.description?.includes('message not found')
      ? '⚠️ پیام وجود ندارد یا bot به آن دسترسی ندارد'
      : `❌ خطای ناشناخته: ${fwd.description}`,
  })
}
