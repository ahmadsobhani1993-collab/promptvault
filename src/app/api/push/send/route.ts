export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sendPushToUser } from '@/lib/push-notifications'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { title, body, url } = await req.json()
    if (typeof title !== 'string' || typeof body !== 'string') {
      return NextResponse.json({ error: 'Invalid notification payload' }, { status: 400 })
    }

    const result = await sendPushToUser(session.user.id, { title, body, url })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[Push] User notification request failed:', error)
    return NextResponse.json({ error: 'ارسال اعلان انجام نشد.' }, { status: 500 })
  }
}
