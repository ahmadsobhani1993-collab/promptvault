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

  if (res.status === 503 || res.status === 429) throw new Error('busy: ' + model)
  if (res.status === 404) throw new Error('notfound: ' + model)
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error('qwen HTTP ' + res.status + ' :: ' + t.slice(0, 300))
  }
  const j = await res.json()
  const text: string = j?.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('empty: ' + model)
  return text
}

export async function qwenGenerate(instruction: string): Promise<string> {
  const models = [
    process.env.TOKENROUTER_MODEL,
    'qwen/qwen3.8-max-free',
    'qwen/qwen3.7-max',
    'qwen/qwen3.8-max',
    'qwen/qwen3.7-plus',
    'qwen/qwen3.5-397b-a17b',
    'qwen/qwen3.5-flash',
    'deepseek/deepseek-v4-pro-0813-free',
  ].filter(Boolean) as string[]

  for (const m of models) {
    try { return await qwenSingle(m, instruction) } catch {}
  }
  throw new Error('all qwen models failed')
}
