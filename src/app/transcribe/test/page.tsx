'use client'

import { useRef, useState } from 'react'
import { LiveTranscriber, TranscriptSegment, getGeminiKey } from '@/lib/live-transcribe'
import { decodeToPcm16k, bufferToBase64Chunks, MAX_AUDIO_MB } from '@/lib/audio'

export default function TestPage() {
  const [status, setStatus] = useState('')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const stopRef = useRef(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
      setStatus(`❌ فایل بزرگ‌تر از ${MAX_AUDIO_MB} مگابایت است`)
      return
    }

    setSegments([])
    stopRef.current = false
    setStatus('در حال دیکود صدا…')

    const pcm = await decodeToPcm16k(file)
    const chunks = bufferToBase64Chunks(pcm, 1)

    setStatus('دریافت کلید و اتصال به Gemini…')
    const key = await getGeminiKey()
    const t = new LiveTranscriber(key)
    t.onSegment = (seg) => setSegments((prev) => [...prev, seg])
    t.onError = (m) => setStatus('❌ ' + m)
    await t.connect()

    setStatus('استریم 1x…')
    for (let i = 0; i < chunks.length; i++) {
      if (stopRef.current) break
      t.sendChunk(chunks[i].data, chunks[i].seconds)
      setStatus(`⏳ استریم: ${Math.round(((i + 1) / chunks.length) * 100)}%`)
      await new Promise((r) => setTimeout(r, 1000))
    }

    t.finish()
    setStatus('✅ تمام')
  }

  return (
    <div className="container-app mx-auto max-w-3xl space-y-4 p-6" dir="rtl">
      <h1 className="font-display text-2xl font-extrabold">تست ترنسکریپت زنده</h1>
      <input type="file" accept="audio/*" onChange={handleFile} />
      <p className="text-sm text-ink-muted">{status}</p>
      <div className="card space-y-1 p-4 text-sm">
        {segments.map((s, i) => (
          <p key={i}>
            <span className="text-ink-muted">[{s.start.toFixed(1)}–{s.end.toFixed(1)}]</span> {s.text}
          </p>
        ))}
      </div>
    </div>
  )
}
