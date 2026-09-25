export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'

async function sendText(chatId: number, text: string) {
  const token = process.env.LOGIN_BOT_TOKEN
  if (!token) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
  } catch (e) {
    console.error('Error sending telegram text:', e)
  }
}

async function sendButton(chatId: number, text: string, buttonText: string, url: string) {
  const token = process.env.LOGIN_BOT_TOKEN
  if (!token) return
  try {
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
  } catch (e) {
    console.error('Error sending telegram button:', e)
  }
}

export async function POST(req: Request) {
  try {
    const update = await req.json()
    const msg = update?.message
    if (!msg || !msg.text || !msg.from) {
      return NextResponse.json({ ok: true })
    }

    const from = msg.from
    const chatId = msg.chat.id

    if (from.is_bot) return NextResponse.json({ ok: true })

    const token = msg.text.startsWith('/start ')
      ? msg.text.replace('/start ', '').trim()
      : null

    if (!token) {
      await sendText(chatId, 'سلام! برای ورود به سایت، از گزینه «ورود با تلگرام» در سایت استفاده کنید.')
      return NextResponse.json({ ok: true })
    }

    const loginToken = await prisma.loginToken.findUnique({ where: { token } })
    if (!loginToken) {
      await sendText(chatId, 'لینک ورود منقضی یا نامعتبر شده است. لطفاً مجدداً از سایت اقدام کنید.')
      return NextResponse.json({ ok: true })
    }

    const tgIdentifier = from.username ? `@${from.username}` : `tg_${from.id}`

    // جستجو بر اساس فیلد معتبر telegram
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { telegram: tgIdentifier },
          ...(from.username ? [{ telegram: `@${from.username}` }] : [])
        ]
      }
    })

    if (!user) {
      // ساخت یوزرنیم یکتا
      let baseUsername = from.username 
        ? from.username.toLowerCase().replace(/[^a-z0-9_]/g, '')
        : (from.first_name ? from.first_name.toLowerCase().replace(/[^a-z0-9_]/g, '') : 'user')

      if (!baseUsername || baseUsername.length < 3) baseUsername = 'user'
      const randomSuffix = crypto.randomBytes(3).toString('hex')
      const finalUsername = `${baseUsername}_${randomSuffix}`

      const displayName = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || 'کاربر پرامپت‌فا'

      user = await prisma.user.create({
        data: {
          telegram: tgIdentifier,
          username: finalUsername,
          name: displayName,
          role: 'USER',
        },
      })
    }

    // تایید توکن ورود کاربر
    await prisma.loginToken.update({
      where: { token },
      data: {
        userId: user.id,
        confirmed: true,
      },
    })

    await sendButton(
      chatId,
      '✅ هویت شما تایید شد! برای ورود به سایت روی دکمه زیر کلیک کنید:',
      '🚀 ورود به پرامپت‌فا',
      `${APP_URL}/api/auth/telegram/callback?token=${token}`
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Telegram webhook handled error:', err)
    return NextResponse.json({ ok: true, handledError: err?.message })
  }
}
