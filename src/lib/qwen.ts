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

async function pollinationsPost(instruction: string): Promise<string> {
  const res = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Referrer: 'https://promptsfa.ir/' },
    body: JSON.stringify({
      model: 'openai',
      messages: [{ role: 'user', content: instruction }],
      temperature: 0.8,
      referrer: 'promptsfa.ir',
    }),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error('pollinations HTTP ' + res.status)
  const j = await res.json()
  const text: string = j?.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('pollinations empty')
  return text
}

export async function qwenGenerate(instruction: string): Promise<string> {
  // 1) free qwen with backoff retries
  if (process.env.TOKENROUTER_API_KEY) {
    for (let i = 0; i < 2; i++) {
      try { return await qwenSingle('qwen/qwen3.8-max-free', instruction, 20000) }
      catch { await sleep(2000 * (i + 1)) }
    }
  }
  // 2) pollinations
  return await pollinationsPost(instruction)
}
