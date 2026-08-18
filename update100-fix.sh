#!/bin/bash
set -e

mkdir -p src/app/api/debug/tokenrouter-models

cat > src/app/api/debug/tokenrouter-models/route.ts << 'EOF'
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
EOF

echo "✅ models route created"

# حالا بقیه update100 (فایل qwen.ts) را بساز
cat > src/lib/qwen.ts << 'EOF'
export async function qwenGenerate(instruction: string): Promise<string> {
  const key = process.env.TOKENROUTER_API_KEY
  if (!key) throw new Error('TOKENROUTER_API_KEY not set')

  const models = [
    process.env.TOKENROUTER_MODEL,
    'qwen/qwen3-max',
    'qwen/qwen3.8-max',
    'qwen/qwen-max-latest',
    'qwen/qwen-plus-latest',
  ].filter(Boolean) as string[]

  for (const model of models) {
    try {
      const res = await fetch('https://api.tokenrouter.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + key,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: instruction }],
          temperature: 0.8,
        }),
        signal: AbortSignal.timeout(45000),
      })

      if (res.status === 503 || res.status === 404) continue

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        if (text.includes('not found') || text.includes('unavailable')) continue
        throw new Error('qwen HTTP ' + res.status + ': ' + text.slice(0, 200))
      }

      const j = await res.json()
      const text: string = j?.choices?.[0]?.message?.content ?? ''
      if (!text) throw new Error('qwen empty response')
      return text
    } catch (e: any) {
      const msg = String(e?.message ?? e)
      if (msg.includes('not found') || msg.includes('unavailable') || msg.includes('503')) continue
      throw e
    }
  }

  throw new Error('all qwen models failed (503/unavailable)')
}
EOF

echo "✅ update100-fix done!"