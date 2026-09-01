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
      setStatus('۱. دریافت کلید از سرور…')
      const key = await getGeminiKey()

      setStatus(`۲. آپلود ${file.name} به Gemini Files…`)
      const uploaded = await uploadAudioFile(file, key)

      setStatus('۳. ترنسکریپت با REST (۱-۲ دقیقه ممکن است طول بکشد)…')
      const segs = await transcribeFile(
        uploaded.uri,
        file.type || 'audio/mpeg',
        key
      )

      setSegments(segs)
      setStatus(`✅ تمام — ${segs.length} سگمنت (${uploaded.name})`)

      // پاکسازی فایل از سرور Gemini
      await deleteFile(uploaded.name, key)
    } catch (err: any) {
      console.error('[transcribe]', err)
      setStatus('❌ ' + (err?.message || String(err)))
    }
  }

  return (
    <div className="container-app mx-auto max-w-3xl space-y-4 p-6" dir="rtl">
      <h1 className="font-display text-2xl font-extrabold">تست ترنسکریپت (REST)</h1>

      <div className="card p-4">
        <input
          type="file"
          accept="audio/*"
          onChange={handleFile}
          className="block w-full text-sm text-ink-muted file:ml-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-700"
        />
        {fileName && (
          <p className="mt-2 text-xs text-ink-muted">فایل: {fileName}</p>
        )}
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
            <button
              onClick={() => {
                const srt = segments
                  .map((s, i) => {
                    const fmt = (t: number) => {
                      const h = Math.floor(t / 3600)
                      const m = Math.floor((t % 3600) / 60)
                      const sec = Math.floor(t % 60)
                      const ms = Math.floor((t % 1) * 1000)
                      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`
                    }
                    return `${i + 1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}`
                  })
                  .join('\n\n')
                navigator.clipboard.writeText(srt)
                alert('SRT کپی شد')
              }}
              className="rounded bg-gray-700 px-3 py-1 text-xs hover:bg-gray-600"
            >
              📋 کپی SRT
            </button>
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
