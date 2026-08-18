#!/bin/bash
set -e

cat > src/lib/qwen.ts << 'EOF'
const FREE_MODELS = [
  'qwen/qwen3.8-max-free',
  'qwen/qwen3.7-max',
  'qwen/qwen3.5-397b-a17b',
  'qwen/qwen3.5-flash',
  'qwen3.6-flash',
  'qwen/qwen3.7-plus',
  'deepseek/deepseek-v4-pro-0813-free',
]

export async function qwenGenerate(instruction: string): Promise<string> {
  const key = process.env.TOKENROUTER_API_KEY
  if (!key) throw new Error('TOKENROUTER_API_KEY not set')

  const models = [process.env.TOKENROUTER_MODEL, ...FREE_MODELS].filter(Boolean) as string[]
  let lastError = ''

  for (const model of models) {
    // 2 attempts per model (free tier = limited capacity, retry helps)
    for (let attempt = 0; attempt < 2; attempt++) {
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
          signal: AbortSignal.timeout(50000),
        })

        if (res.status === 503 || res.status === 429) {
          lastError = model + ': ' + res.status
          await new Promise((r) => setTimeout(r, 3000))
          continue
        }
        if (res.status === 404) { lastError = model + ': 404'; break }

        if (!res.ok) {
          lastError = model + ': HTTP ' + res.status
          continue
        }

        const j = await res.json()
        const text: string = j?.choices?.[0]?.message?.content ?? ''
        if (!text) { lastError = model + ': empty'; continue }
        return text
      } catch (e: any) {
        lastError = model + ': ' + String(e?.message ?? e)
      }
    }
  }

  throw new Error('all free models failed :: ' + lastError)
}
EOF

echo "✅ update101 done! (free models + retry)"