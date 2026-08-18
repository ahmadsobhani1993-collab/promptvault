import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const results: any[] = []
  
  // Google
  try {
    const r = await fetch('https://www.google.com/ping?sitemap=https://promptsfa.ir/sitemap.xml', { signal: AbortSignal.timeout(10000) })
    results.push({ engine: 'google', status: r.status, ok: r.ok })
  } catch (e: any) { results.push({ engine: 'google', error: e.message }) }

  // Bing
  try {
    const r = await fetch('https://www.bing.com/ping?sitemap=https://promptsfa.ir/sitemap.xml', { signal: AbortSignal.timeout(10000) })
    results.push({ engine: 'bing', status: r.status, ok: r.ok })
  } catch (e: any) { results.push({ engine: 'bing', error: e.message }) }

  return NextResponse.json({ ok: true, results })
}
