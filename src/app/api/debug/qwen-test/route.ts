import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const key = process.env.TOKENROUTER_API_KEY
  if (!key) return NextResponse.json({ error: 'TOKENROUTER_API_KEY not set' }, { status: 500 })

  const results: any[] = []
  const models = ['qwen/qwen3.8-max-free', 'qwen/qwen3.7-max', 'qwen/qwen3.5-flash']

  for (const model of models) {
    try {
      const res = await fetch('https://api.tokenrouter.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        }),
        signal: AbortSignal.timeout(20000),
      })
      const body = await res.text()
      results.push({ model, status: res.status, body: body.slice(0, 400) })
      if (res.ok) break
    } catch (e: any) {
      results.push({ model, error: String(e?.message ?? e) })
    }
  }

  return NextResponse.json({ ok: true, results })
}
