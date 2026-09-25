export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://promptsfa.ir'

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  const token = process.env.LOGIN_BOT_TOKEN
  if (!token) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: replyMarkup,
      }),
    })
  } catch (err) {
    console.error('Failed to send telegram message:', err)
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

    const textTrimmed = msg.text.trim()
    const token = textTrimmed.startsWith('/start ')
      ? textTrimmed.replace('/start ', '').trim()
      : null

    if (!token) {
      await sendTelegramMessage(
        chatId,
        '👋 سلام! برای ورود به سایت پرامپت‌فا، ابتدا در سایت روی دکمه «ورود با تلگرام» بزنید تا لینک اختصاصی شما تولید شود.',
        {
          inline_keyboard: [
            [{ text: '🌐 باز کردن سایت پرامپت‌فا', url: `${APP_URL}/login` }]
          ]
        }
      )
      return NextResponse.json({ ok: true })
    }

    const loginToken = await prisma.loginToken.findUnique({
      where: { token },
    })

    if (!loginToken) {
      await sendTelegramMessage(chatId, '❌ این لینک ورود منقضی یا نامعتبر شده است. لطفاً مجدداً از صفحه ورود سایت اقدام فرمایید.')
      return NextResponse.json({ ok: true })
    }

    const tgIdentifier = from.username ? `@${from.username}` : `tg_${from.id}`

    // جستجوی کاربر با فیلد telegram یا تلگرام هندل
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { telegram: tgIdentifier },
          ...(from.username ? [{ telegram: `@${from.username}` }] : [])
        ]
      }
    })

    if (!user) {
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

    // تایید نشست لاگین
    await prisma.loginToken.update({
      where: { token },
      data: {
        userId: user.id,
        confirmed: true,
      },
    })

    const callbackUrl = `${APP_URL}/api/auth/telegram/callback?token=${token}`

    await sendTelegramMessage(
      chatId,
      '✅ هویت شما با موفقیت تایید شد!\nجهت تکمیل ورود و هدایت به پنل کاربری، دکمه زیر را فشار دهید:',
      {
        inline_keyboard: [
          [{ text: '🚀 ورود نهایی به پرامپت‌فا', url: callbackUrl }]
        ]
      }
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Telegram webhook runtime error:', err)
    return NextResponse.json({ ok: true, handledError: err?.message })
  }
}
