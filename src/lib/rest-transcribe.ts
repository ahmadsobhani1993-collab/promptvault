import { getGeminiKey } from './live-transcribe'

export interface TranscriptSegment {
  text: string
  start: number
  end: number
}

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// مدل‌های REST عمومی (Transcribe-Live فقط برای WebSocket است)
const TRANSCRIBE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
]

export { getGeminiKey }

// ترنسکریپت مستقیم با base64 inline (بدون Files API — CORS-safe)
export async function transcribeInline(
  base64: string,
  seconds: number,
  apiKey: string
): Promise<TranscriptSegment[]> {
  const prompt =
    `Transcribe this audio clip completely in its original language (Persian/English/etc). ` +
    `Return ONLY a valid JSON array (no markdown, no explanation): ` +
    `[{"text":"...","start":0.0,"end":1.0},...] ` +
    `start/end are seconds relative to THIS clip (0 to ${seconds.toFixed(1)}).`

  let lastErr = ''
  for (const model of TRANSCRIBE_MODELS) {
    try {
      const res = await fetch(`${API_BASE}/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: 'audio/pcm;rate=16000',
                    data: base64,
                  },
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
        }),
      })

      if (res.status === 429) {
        lastErr = `${model}:429`
        await new Promise((r) => setTimeout(r, 3000))
        continue
      }
      if (res.status === 404) {
        lastErr = `${model}:404`
        continue
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        lastErr = `${model}:${res.status} ${errText.slice(0, 80)}`
        continue
      }

      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const m = text.match(/\[[\s\S]*\]/)
      if (!m) {
        lastErr = `${model}:no-json`
        continue
      }

      const parsed = JSON.parse(m[0]) as any[]
      return parsed
        .filter((s) => typeof s.text === 'string')
        .map((s) => ({
          text: String(s.text),
          start: Number(s.start || 0),
          end: Number(s.end || 0),
        }))
    } catch (e: any) {
      lastErr = `${model}:${e?.message || 'unknown'}`
      continue
    }
  }
  throw new Error('all models failed: ' + lastErr)
}
