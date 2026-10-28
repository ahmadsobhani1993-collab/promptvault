export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

export async function POST() {
  try {
    // Housekeeping: drop tokens older than one hour
    await prisma.loginToken
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } } })
      .catch(() => {})

    const token = crypto.randomBytes(16).toString('hex')

    await prisma.loginToken.create({
      data: { token, status: 'PENDING' },
    })

    const botUsername =
      process.env.TELEGRAM_BOT_USERNAME ||
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ||
      'promptsfabot'

    const cleanBot = botUsername.replace('@', '').trim()
    const targetUrl = `https://t.me/${cleanBot}?start=${token}`

    return NextResponse.json({ ok: true, token, url: targetUrl })
  } catch (error) {
    console.error('Failed to initialize Telegram login token:', error)
    return NextResponse.json({ ok: false, error: 'خطای سرور' }, { status: 500 })
  }
}