import { NextResponse } from 'next/server'
import { importLatestAiDailyNews } from '@/lib/ai-daily-news'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[AI Daily news import] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await importLatestAiDailyNews()
    console.info('[AI Daily news import]', JSON.stringify(result))
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[AI Daily news import failed]', error)
    return NextResponse.json({ error: 'News import failed. Check server logs.' }, { status: 500 })
  }
}
