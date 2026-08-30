import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

export async function POST() {
  const token = crypto.randomBytes(16).toString('hex')
  await prisma.loginToken.create({ data: { token } })

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'telegramloginbot'
  return NextResponse.json({
    token,
    url: `https://t.me/${botUsername}?start=${token}`,
  })
}
