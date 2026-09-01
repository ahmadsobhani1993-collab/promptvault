'use client'

import { useRef, useState } from 'react'
import { LiveTranscriber, TranscriptSegment } from '@/lib/live-transcribe'
import { decodeToPcm16k, bufferToBase64Chunks, MAX_AUDIO_MB } from '@/lib/audio'

const CHUNK_SECONDS = 1 // Live API = هر ثانیه یک chunk

export default function TestPage() {
  const [status, setStatus] = useState('')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [rawLogs, setRawLogs] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [speed, setSpeed] = useState<1 | 2 | 4>(1)
  const stopRef = useRef(false)
  const transcriberRef = useRef<LiveTranscriber | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)

    if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
      setStatus(`❌ فایل بزرگ‌تر از ${MAX_AUDIO_MB} مگابایت است`)
      return
    }

    setSegments([])
    setRawLogs([])
    stopRef.current = false

    try {
      setStatus('۱. دیکود صدا به PCM 16kHz…')
      const pcm = await decodeToPcm16k(file)

      setStatus('۲. ساخت chunk های ۱ ثانیه‌ای…')
      const chunks = bufferToBase64Chunks(pcm, CHUNK_SECONDS)
      setStatus(`۳. ${chunks.length} chunk آماده — اتصال به Worker…`)

      const t = new LiveTranscriber()
      transcriberRef.current = t

      t.onSegment = (seg) => {
        setSegments((prev) => [...prev, seg])
      }

      t.onRawMessage = (msg) => {
        setRawLogs((prev) => [
          ...prev.slice(-8),
          JSON.stringify(msg).slice(0, 400),
        ])
      }

      t.onError = (m) => {
        setStatus('❌ ' + m)
        stopRef.current = true
      }

      // اتصال با timeout ۲۰ ثانیه
      await Promise.race([
        t.connect(),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('timeout اتصال به Worker')), 20000)
        ),
      ])

      setStatus('۴. متصل — ارسال Live…')

      for (let i = 0; i < chunks.length; i++) {
        if (stopRef.current) break

        t.sendChunk(chunks[i].data, chunks[i].seconds)
        setStatus(
          `⏳ Live ${speed}x: ${Math.round(((i + 1) / chunks.length) * 100)}% (${i + 1}/${chunks.length})`
        )

        // pacing: هر chunk هر 1s (1x) یا 0.5s (2x) یا 0.25s (4x)
        await new Promise((r) => setTimeout(r, 1000 / speed))
      }

      if (!stopRef.current) {
        t.finish()
        setStatus(`✅ تمام — ${segments.length} سگمنت از ${fileName}`)
      }
    } catch (err: any) {
      console.error('[live]', err)
      setStatus('❌ ' + (err?.message || String(err)))
    }
  }

  const handleStop = () => {
    stopRef.current = true
    transcriberRef.current?.finish()
    setStatus('⏹ متوقف شد')
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
      <h1 className="font-display text-2xl font-extrabold">تست ترنسکریپت Live</h1>
      <p className="text-sm text-ink-muted">
        روش: Gemini Transcribe Live از طریق Cloudflare Worker • سقف: {MAX_AUDIO_MB}MB
      </p>

      <div className="card space-y-3 p-4">
        <input
          type="file"
          accept="audio/*"
          onChange={handleFile}
          className="block w-full text-sm text-ink-muted file:ml-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-700"
        />
        {fileName && <p className="text-xs text-ink-muted">فایل: {fileName}</p>}

        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-muted">سرعت:</span>
          {([1, 2, 4] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded px-3 py-1 text-xs ${
                speed === s ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {s}x
            </button>
          ))}
          {segments.length > 0 && (
            <button
              onClick={handleStop}
              className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
            >
              ⏹ توقف
            </button>
          )}
        </div>
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

      <div className="card max-h-96 space-y-2 overflow-y-auto p-4 text-sm">
        <div className="flex items-center justify-between border-b border-gray-700 pb-2">
          <strong>متن زنده ({segments.length} سگمنت)</strong>
          {segments.length > 0 && (
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
          )}
        </div>
        {segments.length === 0 && (
          <p className="text-ink-muted">هنوز متنی دریافت نشده…</p>
        )}
        {segments.map((s, i) => (
          <div key={i} className="flex gap-2">
            <span className="shrink-0 font-mono text-xs text-ink-muted">
              [{s.start.toFixed(1)}–{s.end.toFixed(1)}]
            </span>
            <span>{s.text}</span>
          </div>
        ))}
      </div>

      {rawLogs.length > 0 && (
        <details className="card p-4 text-xs" dir="ltr">
          <summary className="cursor-pointer">Raw Gemini Messages (debug)</summary>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-[11px]">
            {rawLogs.join('\n\n')}
          </pre>
        </details>
      )}
    </div>
  )
}
