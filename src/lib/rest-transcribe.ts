import { getGeminiKey } from './live-transcribe'

export interface TranscriptSegment {
  text: string
  start: number
  end: number
}

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// همان زنجیره مدل‌های REST که در ایمپورت کار می‌کنند + fallback
const TRANSCRIBE_MODELS = [
  'gemini-3.5-Transcribe-Live',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
]

export { getGeminiKey }

// آپلود مستقیم فایل صوتی به Files API (بدون base64، تا 20MB)
export async function uploadAudioFile(file: Blob, apiKey: string): Promise<{ name: string; uri: string }> {
  const mime = file.type || 'audio/mpeg'

  const startRes = await fetch(`${API_BASE}/upload/files?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(file.size),
      'X-Goog-Upload-Header-Content-Type': mime,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'transcribe-audio' } }),
  })
  if (!startRes.ok) throw new Error('upload start failed: ' + startRes.status)

  const uploadUrl = startRes.headers.get('x-goog-upload-url')
  if (!uploadUrl) throw new Error('no upload url')

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
      'Content-Type': mime,
    },
    body: file,
  })
  if (!uploadRes.ok) throw new Error('upload failed: ' + uploadRes.status)

  const data = await uploadRes.json()
  return { name: data.file.name, uri: data.file.uri }
}

// ترنسکریپت با REST + تایم‌استمپ JSON
export async function transcribeFile(
  fileUri: string,
  mime: string,
  apiKey: string
): Promise<TranscriptSegment[]> {
  const prompt =
    'Transcribe this audio completely in its original language. ' +
    'Return ONLY a valid JSON array (no markdown): ' +
    '[{"text":"...","start":0.0,"end":1.2},...] ' +
    'start/end are seconds from the beginning of the audio.'

  let lastErr = ''
  for (const model of TRANSCRIBE_MODELS) {
    const res = await fetch(`${API_BASE}/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { file_data: { mime_type: mime, file_uri: fileUri } },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 65536 },
      }),
    })

    if (res.status === 404 || res.status === 429) {
      lastErr = `${model}:${res.status}`
      continue
    }
    if (!res.ok) {
      lastErr = `${model}:${res.status}`
      continue
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const m = text.match(/\[[\s\S]*\]/)
    if (!m) throw new Error('no JSON in response')

    return (JSON.parse(m[0]) as any[]).map((s) => ({
      text: String(s.text || ''),
      start: Number(s.start || 0),
      end: Number(s.end || 0),
    }))
  }
  throw new Error('all models failed: ' + lastErr)
}

export async function deleteFile(name: string, apiKey: string) {
  await fetch(`${API_BASE}/${name}?key=${apiKey}`, { method: 'DELETE' }).catch(() => {})
}
