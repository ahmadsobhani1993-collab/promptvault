import { NextResponse } from 'next/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'

export async function GET() {
  const token = process.env.LOGIN_BOT_TOKEN
  const res = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(APP_URL + '/api/telegram/webhook')}`
  )
  const data = await res.json()
  return NextResponse.json(data)
}
