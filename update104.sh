#!/bin/bash
set -e

# ---------- 1) qwen.ts: qwen free + pollinations text fallback ----------
cat > src/lib/qwen.ts << 'EOF'
export async function qwenSingle(model: string, instruction: string, timeoutMs = 25000): Promise<string> {
  const key = process.env.TOKENROUTER_API_KEY
  if (!key) throw new Error('TOKENROUTER_API_KEY not set')

  const res = await fetch('https://api.tokenrouter.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: instruction }],
      temperature: 0.8,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error('qwen HTTP ' + res.status + ' :: ' + t.slice(0, 300))
  }
  const j = await res.json()
  const text: string = j?.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('empty: ' + model)
  return text
}

export async function pollinationsGenerate(instruction: string): Promise<string> {
  const res = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      messages: [{ role: 'user', content: instruction }],
      temperature: 0.8,
    }),
    signal: AbortSignal.timeout(45000),
  })
  if (!res.ok) throw new Error('pollinations HTTP ' + res.status)
  const j = await res.json()
  const text: string = j?.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('pollinations empty')
  return text
}

export async function qwenGenerate(instruction: string): Promise<string> {
  // 1) free qwen on tokenrouter (2 quick tries)
  if (process.env.TOKENROUTER_API_KEY) {
    for (let i = 0; i < 2; i++) {
      try { return await qwenSingle('qwen/qwen3.8-max-free', instruction, 20000) } catch {}
    }
  }
  // 2) pollinations text (free, no key)
  return await pollinationsGenerate(instruction)
}
EOF
echo "✅ qwen.ts: pollinations text fallback"

# ---------- 2) article step1: use qwenGenerate ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/cron/article/route.ts'
let s = fs.readFileSync(p, 'utf8')

s = s.replace("import { qwenSingle } from '@/lib/qwen'", "import { qwenGenerate } from '@/lib/qwen'")

const old = `    const started = Date.now()
    let raw = ''
    let err = ''
    for (const model of TEXT_MODELS) {
      if (Date.now() - started > 40000) break
      try {
        raw = await qwenSingle(model, INSTRUCTION, 25000)
        break
      } catch (e: any) { err = String(e?.message ?? e) }
    }
    if (!raw) return NextResponse.json({ ok: false, error: 'qwen busy: ' + err, schedule })`

const nw = `    let raw = ''
    let err = ''
    try { raw = await qwenGenerate(INSTRUCTION) } catch (e: any) { err = String(e?.message ?? e) }
    if (!raw) return NextResponse.json({ ok: false, error: 'text gen failed: ' + err, schedule })`

if (s.includes(old)) { s = s.replace(old, nw); fs.writeFileSync(p, s); console.log('✅ article: qwenGenerate with fallback') }
else console.log('❌ step1 block not found')
NODEEOF

echo "✅ update104 done!"