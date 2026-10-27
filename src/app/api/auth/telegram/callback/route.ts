export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://promptsfa.ir'

// No side effects on GET: link-preview bots would otherwise burn the one-time token.
// The actual sign-in happens in the client page, which requires JavaScript.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')

  if (!token || token.length > 200) {
    return NextResponse.redirect(`${APP_URL}/login?error=missing_token`)
  }

  return NextResponse.redirect(`${APP_URL}/login/telegram-verify?token=${encodeURIComponent(token)}`)
}