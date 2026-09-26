// app/api/telegram/setup/route.ts
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.LOGIN_BOT_TOKEN
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://promptsfa.ir'
  const webhookUrl = `${appUrl}/api/telegram/webhook`

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&secret_token=${encodeURIComponent(secret)}`
    )
    
    const data = await res.json()
    
    if (!data.ok) {
      return NextResponse.json({ error: 'Failed to set webhook', details: data }, { status: 400 })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook set successfully',
      webhook_url: webhookUrl,
      has_secret: !!secret
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 })
  }
}