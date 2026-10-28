export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import crypto, { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/db'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://promptsfa.ir'
const TOKEN_TTL_MS = 10 * 60 * 1000
const TOKEN_RE = /^[a-f0-9]{32}$/

// Fail closed: without a configured secret every request is rejected.
function secretOk(req: Request): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return false
  const got = req.headers.get('x-telegram-bot-api-secret-token') || ''
  const a = Buffer.from(got)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

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
  if (!msg || typeof msg.text !== 'string' || !msg.from || msg.from.is_bot) return
  // Login happens only in a private chat with the bot
  if (msg.chat?.type !== 'private') return

  const from = msg.from
  const chatId: number = msg.chat.id
  const textTrimmed = msg.text.trim()
  const token = textTrimmed.startsWith('/start ') ? textTrimmed.slice('/start '.length).trim() : null

  if (!token) {
    await sendTelegramMessage(chatId, '👋 سلام! برای ورود، ابتدا از صفحه لاگین سایت روی «ورود با تلگرام» بزنید.', {
      inline_keyboard: [[{ text: '🌐 باز کردن سایت', url: `${APP_URL}/login` }]],
    })
    return
  }

  if (!TOKEN_RE.test(token)) {
    await sendTelegramMessage(chatId, '❌ لینک ورود منقضی یا نامعتبر است.')
    return
  }

  const loginToken = await prisma.loginToken.findUnique({ where: { token } })
  const isExpired = loginToken ? Date.now() - loginToken.createdAt.getTime() > TOKEN_TTL_MS : true

  if (!loginToken || isExpired || loginToken.status !== 'PENDING') {
    await sendTelegramMessage(chatId, '❌ لینک ورود منقضی یا نامعتبر است.')
    return
  }

  const tgIdStr = String(from.id)
  let user = await prisma.user.findUnique({ where: { telegram: tgIdStr } })

  if (!user) {
    let baseUsername = from.username
      ? from.username.toLowerCase().replace(/[^a-z0-9_]/g, '')
      : from.first_name
        ? from.first_name.toLowerCase().replace(/[^a-z0-9_]/g, '')
        : 'user'

    if (baseUsername.length < 3) baseUsername = 'user'
    const finalUsername = `${baseUsername}_${crypto.randomBytes(3).toString('hex')}`
    const displayName = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || 'کاربر'

    try {
      user = await prisma.user.create({
        data: { telegram: tgIdStr, username: finalUsername, name: displayName, role: 'USER' },
      })
    } catch {
      // Two updates at once: the other one created the user first
      user = await prisma.user.findUnique({ where: { telegram: tgIdStr } })
    }
  }

  if (!user) return

  // Atomic: only the first request can move PENDING -> CONFIRMED
  const { count } = await prisma.loginToken.updateMany({
    where: { token, status: 'PENDING' },
    data: { telegramId: tgIdStr, status: `CONFIRMED:${user.id}` },
  })
  if (count !== 1) {
    await sendTelegramMessage(chatId, '❌ لینک ورود منقضی یا نامعتبر است.')
    return
  }

  await sendTelegramMessage(chatId, '✅ هویت تایید شد! برای تکمیل ورود کلیک کنید:', {
    inline_keyboard: [[{ text: '🚀 تکمیل ورود', url: `${APP_URL}/login/telegram-verify?token=${token}` }]],
  })
}

export async function POST(req: Request) {
  if (!secretOk(req)) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const update = await req.json()

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