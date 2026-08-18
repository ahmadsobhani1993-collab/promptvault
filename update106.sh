#!/bin/bash
set -e

cat > src/lib/qwen.ts << 'EOF'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

// Hugging Face Inference API (free, no key needed for public models)
async function huggingFaceGenerate(instruction: string): Promise<string> {
  const models = [
    'mistralai/Mixtral-8x7B-Instruct-v0.1',
    'meta-llama/Llama-3.3-70B-Instruct',
    'microsoft/DialoGPT-medium',
  ]

  for (const model of models) {
    try {
      const res = await fetch('https://api-inference.huggingface.co/models/' + model, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: instruction, parameters: { max_new_tokens: 2000, temperature: 0.8 } }),
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) continue
      const j = await res.json()
      const text: string = j?.[0]?.generated_text ?? j?.generated_text ?? ''
      if (text) return text
    } catch {}
  }
  throw new Error('huggingface all failed')
}

export async function qwenGenerate(instruction: string): Promise<string> {
  // 1) free qwen with aggressive retries
  if (process.env.TOKENROUTER_API_KEY) {
    for (let i = 0; i < 3; i++) {
      try { 
        return await qwenSingle('qwen/qwen3.8-max-free', instruction, 20000) 
      } catch (e: any) {
        const msg = String(e?.message ?? '')
        if (msg.includes('503')) await sleep(3000 * (i + 1))
        else break
      }
    }
  }
  // 2) hugging face (free, no key)
  return await huggingFaceGenerate(instruction)
}
EOF

echo "✅ qwen.ts: Hugging Face fallback added"