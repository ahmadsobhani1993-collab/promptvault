export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://promptsfa.ir'
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  const token = process.env.LOGIN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
    })
  } catch (err) {
    console.error('Failed to send telegram message:', err)
  }
}

async function processUpdate(update: any) {
  const msg = update?.message
  if (!msg || !msg.text || !msg.from || msg.from.is_bot) return

  const { from, chat: { id: chatId } } = msg
  const textTrimmed = msg.text.trim()
  const token = textTrimmed.startsWith('/start ') ? textTrimmed.replace('/start ', '').trim() : null

  if (!token) {
    await sendTelegramMessage(chatId, '👋 سلام! برای ورود، ابتدا از صفحه لاگین سایت روی «ورود با تلگرام» بزنید.', {
      inline_keyboard: [[{ text: '🌐 باز کردن سایت', url: `${APP_URL}/login` }]]
    })
    return
  }

  const loginToken = await prisma.loginToken.findUnique({ where: { token } })
  
  // بهینه‌سازی: حذف new Date() اضافی (Prisma خودش Date برمی‌گرداند)
  const isExpired = loginToken ? Date.now() - loginToken.createdAt.getTime() > 600000 : true

  if (!loginToken || isExpired || loginToken.status !== 'PENDING') {
    await sendTelegramMessage(chatId, '❌ لینک ورود منقضی یا نامعتبر است.')
    return
  }

  const tgIdStr = String(from.id)
  let user = await prisma.user.findUnique({ where: { telegram: tgIdStr } })

  if (!user) {
    let baseUsername = from.username 
      ? from.username.toLowerCase().replace(/[^a-z0-9_]/g, '') 
      : (from.first_name ? from.first_name.toLowerCase().replace(/[^a-z0-9_]/g, '') : 'user')
    
    if (baseUsername.length < 3) baseUsername = 'user'
    const finalUsername = `${baseUsername}_${crypto.randomBytes(3).toString('hex')}`
    const displayName = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || 'کاربر'

    user = await prisma.user.create({
      data: { telegram: tgIdStr, username: finalUsername, name: displayName, role: 'USER' }
    })
  }

  await prisma.loginToken.update({
    where: { token },
    data: { telegramId: tgIdStr, status: `CONFIRMED:${user.id}` }
  })

  await sendTelegramMessage(chatId, '✅ هویت تایید شد! برای تکمیل ورود کلیک کنید:', {
    inline_keyboard: [[{ text: '🚀 تکمیل ورود', url: `${APP_URL}/login/telegram-verify?token=${token}` }]]
  })
}

export async function POST(req: Request) {
  if (WEBHOOK_SECRET && req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const update = await req.json()

    // جلوگیری از Unhandled Rejection در پس‌زمینه
    waitUntil(
      (async () => {
        try {
          await processUpdate(update)
        } catch (err) {
          console.error('Background processUpdate failed:', err)
        }
      })()
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Telegram webhook parse error:', err)
    return NextResponse.json({ ok: true })
  }
}