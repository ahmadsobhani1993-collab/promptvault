#!/bin/bash
set -e

# ---------- 1) qwen lib ----------
cat > src/lib/qwen.ts << 'EOF'
export async function qwenGenerate(instruction: string): Promise<string> {
  const key = process.env.TOKENROUTER_API_KEY
  if (!key) throw new Error('TOKENROUTER_API_KEY not set')

  const res = await fetch('https://api.tokenrouter.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + key,
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.8-max-free',
      messages: [{ role: 'user', content: instruction }],
      temperature: 0.8,
    }),
    signal: AbortSignal.timeout(45000),
  })

  if (!res.ok) throw new Error('qwen HTTP ' + res.status)
  const j = await res.json()
  const text: string = j?.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('qwen empty response')
  return text
}
EOF

# ---------- 2) gemini cascade falls back to qwen ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/lib/gemini.ts'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('qwenGenerate')) {
  s = s.replace(
    "export const TAG_VOCAB",
    "import { qwenGenerate } from '@/lib/qwen'\n\nexport const TAG_VOCAB"
  )
  s = s.replace(
    "throw new Error('GEMINI_QUOTA_EXHAUSTED :: ' + lastError)",
    "try {\n    const t = await qwenGenerate(opts.instruction)\n    return { text: t, model: 'qwen3.8-max-free' }\n  } catch {}\n  throw new Error('GEMINI_QUOTA_EXHAUSTED :: ' + lastError)"
  )
  fs.writeFileSync(p, s)
  console.log('✅ gemini: qwen fallback added')
} else console.log('⚠️ already has qwen')
NODEEOF

echo "✅ update98 done!"