import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const key = process.env.TOKENROUTER_API_KEY
  if (!key) return NextResponse.json({ error: 'TOKENROUTER_API_KEY not set' }, { status: 500 })

  try {
    const res = await fetch('https://api.tokenrouter.com/v1/models', {
      headers: { Authorization: 'Bearer ' + key },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'HTTP ' + res.status, body: await res.text().catch(() => '') })
    }

    const j = await res.json()
    const models = j?.data || j?.models || []

    const free = models.filter((m: any) => {
      const id = m.id || m.name || ''
      return id.toLowerCase().includes('free') || id.toLowerCase().includes('qwen')
    })

    return NextResponse.json({
      ok: true,
      total: models.length,
      freeModels: free.map((m: any) => m.id || m.name).slice(0, 50),
      allModels: models.map((m: any) => m.id || m.name).slice(0, 100),
    })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) })
  }
}
