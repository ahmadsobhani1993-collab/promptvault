#!/bin/bash
set -e

mkdir -p src/app/api/debug/qwen-test

# ---------- 1) qwen: include body in errors ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/qwen.ts'
let s = fs.readFileSync(p, 'utf8')
s = s.replace(
  "if (!res.ok) throw new Error('qwen HTTP ' + res.status)",
  "if (!res.ok) {\n    const t = await res.text().catch(() => '')\n    throw new Error('qwen HTTP ' + res.status + ' :: ' + t.slice(0, 300))\n  }"
)
fs.writeFileSync(p, s)
console.log('✅ qwen: error body included')
NODEEOF

# ---------- 2) debug test route ----------
cat > src/app/api/debug/qwen-test/route.ts << 'EOF'
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
EOF
echo "✅ qwen-test route created"

echo "✅ update103 done!"