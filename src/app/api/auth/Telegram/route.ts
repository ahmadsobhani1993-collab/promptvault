import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { signIn } from '@/auth'
import crypto from 'crypto'

// تابع تأیید امضای تلگرام
function verifyTelegramAuth(data: any, botToken: string): boolean {
  const { hash, auth_date, ...checkData } = data
  
  // ساخت چک‌سام
  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  
  const dataCheckString = Object.keys(checkData)
    .sort()
    .map((key) => `${key}=${checkData[key]}`)
    .join('\n')
  
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  
  return hmac === hash
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const botToken = process.env.LOGIN_BOT_TOKEN
    
    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 })
    }

    // تأیید امضا
    if (!verifyTelegramAuth(body, botToken)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    // بررسی تاریخ (۲۴ ساعت)
    const authDate = new Date(body.auth_date * 1000)
    const now = new Date()
    const hoursDiff = (now.getTime() - authDate.getTime()) / (1000 * 60 * 60)
    
    if (hoursDiff > 24) {
      return NextResponse.json({ error: 'Auth date expired' }, { status: 403 })
    }

    // پیدا کردن یا ساخت کاربر
    const telegramId = String(body.id)
    
    let user = await prisma.user.findUnique({
      where: { telegramId }
    })

    if (!user) {
      // ساخت کاربر جدید
      user = await prisma.user.create({
        data: {
          telegramId,
          name: `${body.first_name} ${body.last_name || ''}`.trim(),
          email: body.username ? `${body.username}@telegram.local` : null,
          image: body.photo_url || null,
          role: 'USER',
        }
      })
    }

    // لاگین کاربر
    await signIn('credentials', {
      redirect: false,
      userId: user.id,
    })

    return NextResponse.json({ 
      success: true, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email 
      } 
    })

  } catch (error) {
    console.error('Telegram auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}