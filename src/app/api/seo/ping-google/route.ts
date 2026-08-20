import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const results: any[] = []
  const sitemapUrl = 'https://promptsfa.ir/sitemap.xml'

  // Ping Google
  try {
    const res = await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`, {
      signal: AbortSignal.timeout(10000),
    })
    const text = await res.text()
    results.push({
      engine: 'Google',
      status: res.status,
      ok: res.ok,
      response: text.slice(0, 200),
    })
  } catch (err: any) {
    results.push({ engine: 'Google', error: err.message })
  }

  // Ping Bing
  try {
    const res = await fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`, {
      signal: AbortSignal.timeout(10000),
    })
    const text = await res.text()
    results.push({
      engine: 'Bing',
      status: res.status,
      ok: res.ok,
      response: text.slice(0, 200),
    })
  } catch (err: any) {
    results.push({ engine: 'Bing', error: err.message })
  }

  // Get total prompts count
  const totalPrompts = await prisma.prompt.count()

  return NextResponse.json({
    ok: true,
    pinged: ['Google', 'Bing'],
    results,
    sitemap: sitemapUrl,
    totalPages: totalPrompts,
    message: 'گوگل و بینگ از وجود سایت شما مطلع شدند. ایندکس شدن ۲-۷ روز طول می‌کشد.',
  })
}
