import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'

async function sendText(chatId: number, text: string) {
  const token = process.env.LOGIN_BOT_TOKEN
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

async function sendButton(chatId: number, text: string, buttonText: string, url: string) {
  const token = process.env.LOGIN_BOT_TOKEN
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: buttonText, url }]],
      },
    }),
  })
}

export async function POST(req: Request) {
  const update = await req.json()
  const msg = update.message
  if (!msg || !msg.text || !msg.from) return NextResponse.json({ ok: true })

  const from = msg.from
  const chatId = msg.chat.id

  if (from.is_bot) return NextResponse.json({ ok: true })

  const token = msg.text.startsWith('/start ')
    ? msg.text.replace('/start ', '').trim()
    : null

  if (!token) {
    await sendText(chatId, 'برای ورود، از دکمه «ورود با تلگرام» در سایت استفاده کنید.')
    return NextResponse.json({ ok: true })
  }

  const loginToken = await prisma.loginToken.findUnique({ where: { token } })
  if (!loginToken) {
    await sendText(chatId, 'لینک منقضی شده. دوباره از سایت تلاش کنید.')
    return NextResponse.json({ ok: true })
  }

  const telegramId = String(from.id)
  let user = await prisma.user.findUnique({ where: { telegramId } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId,
        name: [from.first_name, from.last_name].filter(Boolean).join(' '),
        role: 'USER',
      },
    })
  }

  await prisma.loginToken.update({
    where: { token },
    data: { telegramId, status: 'APPROVED' },
  })

  await sendButton(
    chatId,
    '✅ ورود تأیید شد. برای تکمیل ورود روی دکمه زیر بزنید:',
    '🔐 ورود به سایت',
    `${APP_URL}/api/auth/telegram/callback?token=${token}`
  )

  return NextResponse.json({ ok: true })
}
