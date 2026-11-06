export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { getVapidKeys } from '@/lib/push-notifications'

export async function GET() {
  try {
    const keys = await getVapidKeys()
    return NextResponse.json(
      { publicKey: keys.publicKey },
      { headers: { 'Cache-Control': 'public, max-age=3600' } },
    )
  } catch (error) {
    console.error('[Push] Failed to load VAPID public key:', error)
    return NextResponse.json({ error: 'کلید اعلان‌ها در دسترس نیست.' }, { status: 500 })
  }
}
