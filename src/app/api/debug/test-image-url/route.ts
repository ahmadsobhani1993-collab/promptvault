import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Please provide ?url=...' }, { status: 400 })
  }

  try {
    const res = await fetch(url, { 
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000) 
    })
    
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get('content-type'),
      contentLength: res.headers.get('content-length'),
      hint: res.ok ? 'لینک سالم است و باید در سایت نمایش داده شود.' : 'لینک خراب است یا تلگرام دسترسی را بسته است.'
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message })
  }
}
