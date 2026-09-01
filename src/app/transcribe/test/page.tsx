'use client'

import { useState } from 'react'
import {
  getGeminiKey,
  uploadAudioFile,
  transcribeFile,
  deleteFile,
  TranscriptSegment,
} from '@/lib/rest-transcribe'
import { MAX_AUDIO_MB } from '@/lib/audio'

export default function TestPage() {
  const [status, setStatus] = useState('')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
      setStatus(`❌ فایل بزرگ‌تر از ${MAX_AUDIO_MB} مگابایت است`)
      return
    }

    setSegments([])
    try {
      setStatus('۱. دریافت کلید…')
      const key = await getGeminiKey()

      setStatus('۲. آپلود مستقیم به Gemini Files…')
      const uploaded = await uploadAudioFile(file, key)

      setStatus('۳. ترنسکریپت (ممکن است ۱-۲ دقیقه طول بکشد)…')
      const segs = await transcribeFile(uploaded.uri, file.type || 'audio/mpeg', key)

      setSegments(segs)
      setStatus(`✅ تمام — ${segs.length} سگمنت`)

      deleteFile(uploaded.name, key)
    } catch (err: any) {
      console.error('[transcribe]', err)
      setStatus('❌ ' + (err?.message || String(err)))
    }
  }

  return (
    <div className="container-app mx-auto max-w-3xl space-y-4 p-6" dir="rtl">
      <h1 className="font-display text-2xl font-extrabold">تست ترنسکریپت (REST)</h1>
      <input type="file" accept="audio/*" onChange={handleFile} />
      <p className="text-sm text-ink-muted">{status}</p>
      <div className="card max-h-96 space-y-1 overflow-y-auto p-4 text-sm">
        {segments.map((s, i) => (
          <p key={i}>
            <span className="text-ink-muted">[{s.start.toFixed(1)}–{s.end.toFixed(1)}]</span> {s.text}
          </p>
        ))}
      </div>
    </div>
  )
}
