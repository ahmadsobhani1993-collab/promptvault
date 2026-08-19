import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Check Gemini API quota (if using Gemini)
  const geminiKey = process.env.GEMINI_API_KEY
  const result: any = {
    gemini: { configured: !!geminiKey, keyLength: geminiKey?.length || 0 },
    timestamp: new Date().toISOString(),
  }

  // Try a simple Gemini call to check quota
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'hi' }] }],
          }),
        }
      )
      
      if (res.status === 429) {
        result.gemini.status = 'quota_exhausted'
        result.gemini.message = 'Rate limit or quota exceeded'
      } else if (res.ok) {
        result.gemini.status = 'ok'
      } else {
        const errData = await res.json().catch(() => ({}))
        result.gemini.status = 'error_' + res.status
        result.gemini.message = errData.error?.message || 'Unknown error'
      }
    } catch (err: any) {
      result.gemini.status = 'error'
      result.gemini.message = err.message
    }
  }

  return NextResponse.json(result)
}
