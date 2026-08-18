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
