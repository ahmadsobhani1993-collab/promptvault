import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

export async function POST() {
  try {
    const token = crypto.randomBytes(16).toString('hex')

    // ذخیره در دیتابیس
    await prisma.loginToken.create({
      data: {
        token,
        status: 'PENDING',
      },
    })

    const botUsername =
      process.env.TELEGRAM_BOT_USERNAME ||
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ||
      'promptsfabot'

    const cleanBot = botUsername.replace('@', '').trim()
    const targetUrl = `https://t.me/${cleanBot}?start=${token}`

    return NextResponse.json({
      ok: true,
      token,
      url: targetUrl,
    })
  } catch (error: any) {
    console.error('❌ Failed to initialize Telegram login token:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Database error occurred',
      },
      { status: 500 }
    )
  }
}
