'use client'

import { useState } from 'react'
import { getGeminiKey, transcribeInline, TranscriptSegment } from '@/lib/rest-transcribe'
import { decodeToPcm16k, bufferToBase64Chunks, MAX_AUDIO_MB } from '@/lib/audio'

const CHUNK_SECONDS = 60

export default function TestPage() {
  const [status, setStatus] = useState('')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [fileName, setFileName] = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)

    if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
      setStatus(`❌ فایل بزرگ‌تر از ${MAX_AUDIO_MB} مگابایت است`)
      return
    }

    setSegments([])

    try {
      setStatus('۱. دیکود صدا به PCM 16kHz…')
      const pcm = await decodeToPcm16k(file)
      const chunks = bufferToBase64Chunks(pcm, CHUNK_SECONDS)
      setStatus(`۲. آماده — ${chunks.length} chunk (${CHUNK_SECONDS}s هرکدام)`)

      setStatus('۳. دریافت کلید از سرور…')
      const key = await getGeminiKey()

      const all: TranscriptSegment[] = []

      for (let i = 0; i < chunks.length; i++) {
        setStatus(`۴. ترنسکریپت chunk ${i + 1}/${chunks.length}…`)

        const segs = await transcribeInline(chunks[i].data, chunks[i].seconds, key)
        const offset = i * CHUNK_SECONDS

        const shifted = segs.map((s) => ({
          ...s,
          start: s.start + offset,
          end: s.end + offset,
        }))

        all.push(...shifted)
        setSegments([...all])

        // رعایت rate limit (هر chunk ~1-2s مکث)
        await new Promise((r) => setTimeout(r, 1000))
      }

      setStatus(`✅ تمام — ${all.length} سگمنت از ${fileName}`)
    } catch (err: any) {
      console.error('[transcribe]', err)
      setStatus('❌ ' + (err?.message || String(err)))
    }
  }

  const toSrt = (segs: TranscriptSegment[]) => {
    const fmt = (t: number) => {
      const h = Math.floor(t / 3600)
      const m = Math.floor((t % 3600) / 60)
      const s = Math.floor(t % 60)
      const ms = Math.floor((t % 1) * 1000)
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
    }
    return segs
      .map((s, i) => `${i + 1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}`)
      .join('\n\n')
  }

  return (
    <div className="container-app mx-auto max-w-3xl space-y-4 p-6" dir="rtl">
      <h1 className="font-display text-2xl font-extrabold">تست ترنسکریپت (REST inline)</h1>
      <p className="text-sm text-ink-muted">
        حداکثر حجم: {MAX_AUDIO_MB}MB • پردازش مستقیم از مرورگر شما به Gemini
      </p>

      <div className="card p-4">
        <input
          type="file"
          accept="audio/*"
          onChange={handleFile}
          className="block w-full text-sm text-ink-muted file:ml-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-700"
        />
        {fileName && <p className="mt-2 text-xs text-ink-muted">فایل: {fileName}</p>}
      </div>

      {status && (
        <div
          className={`rounded-lg p-3 text-sm ${
            status.startsWith('✅')
              ? 'bg-green-500/10 text-green-400'
              : status.startsWith('❌')
              ? 'bg-red-500/10 text-red-400'
              : 'bg-blue-500/10 text-blue-400'
          }`}
        >
          {status}
        </div>
      )}

      {segments.length > 0 && (
        <div className="card max-h-96 space-y-2 overflow-y-auto p-4 text-sm">
          <div className="flex items-center justify-between border-b border-gray-700 pb-2">
            <strong>متن ترنسکریپت ({segments.length} سگمنت)</strong>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(segments.map((s) => s.text).join(' '))
                  alert('متن کامل کپی شد')
                }}
                className="rounded bg-gray-700 px-3 py-1 text-xs hover:bg-gray-600"
              >
                📋 متن
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(toSrt(segments))
                  alert('SRT کپی شد')
                }}
                className="rounded bg-gray-700 px-3 py-1 text-xs hover:bg-gray-600"
              >
                📋 SRT
              </button>
            </div>
          </div>
          {segments.map((s, i) => (
            <div key={i} className="flex gap-2">
              <span className="shrink-0 font-mono text-xs text-ink-muted">
                [{s.start.toFixed(1)}–{s.end.toFixed(1)}]
              </span>
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
