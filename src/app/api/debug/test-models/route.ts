import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  // لیست مدل‌های شما + مدل‌های رسمی شناخته شده برای مقایسه
  const modelsToTest = [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    // مدل‌های رسمی و تضمین‌شده رایگان برای مقایسه
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ]

  const results: any[] = []

  for (const model of modelsToTest) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hi' }] }],
          }),
        }
      )

      const data = await res.json().catch(() => ({}))

      results.push({
        model,
        status: res.status,
        ok: res.ok,
        errorDetails: data.error?.message || (res.ok ? 'Success' : 'Unknown error'),
      })
    } catch (err: any) {
      results.push({
        model,
        status: 'CRASH',
        ok: false,
        errorDetails: err.message,
      })
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    results,
    summary: `Found ${results.filter(r => r.ok).length} working models.`
  })
}
