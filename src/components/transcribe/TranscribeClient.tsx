'use client'

import { useRef, useState } from 'react'
import { LiveTranscriber, TranscriptSegment, getGeminiKey } from '@/lib/live-transcribe'
import { decodeToPcm16k, bufferToBase64Chunks, MAX_AUDIO_MB } from '@/lib/audio'
import { toSrt, toVtt, toTxt, download } from '@/lib/subtitle'

export default function TranscribeClient() {
  const [status, setStatus] = useState('')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [speed, setSpeed] = useState<1 | 2 | 4>(1)
  const stopRef = useRef(false)
  const tRef = useRef<LiveTranscriber | null>(null)

  const baseName = fileName.replace(/\.[^.]+$/, '') || 'transcript'

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
      setStatus(`❌ فایل بزرگ‌تر از ${MAX_AUDIO_MB} مگابایت است`)
      return
    }

    setSegments([])
    setProgress(0)
    setBusy(true)
    stopRef.current = false

    try {
      setStatus('۱. دیکود صدا…')
      const pcm = await decodeToPcm16k(file)
      const chunks = bufferToBase64Chunks(pcm, 1)

      setStatus('۲. اتصال به سرور…')
      const key = await getGeminiKey()
      const t = new LiveTranscriber(key)
      tRef.current = t

      t.onSegment = (seg) => setSegments((prev) => [...prev, seg])
      t.onError = (m) => setStatus('❌ ' + m)

      await Promise.race([
        t.connect(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout اتصال')), 20000)),
      ])

      setStatus('۳. ترنسکریپت زنده…')
      for (let i = 0; i < chunks.length; i++) {
        if (stopRef.current) break
        t.sendChunk(chunks[i].data, chunks[i].seconds)
        setProgress(Math.round(((i + 1) / chunks.length) * 100))
        await new Promise((r) => setTimeout(r, 1000 / speed))
      }

      if (!stopRef.current) {
        setStatus('۴. دریافت متن پایانی…')
        await t.finish()
        setStatus('✅ ترنسکریپت تمام شد — متن را ادیت و خروجی بگیر')
      }
    } catch (err: any) {
      console.error('[transcribe]', err)
      setStatus('❌ ' + (err?.message || String(err)))
    } finally {
      setBusy(false)
    }
  }

  const updateText = (i: number, text: string) =>
    setSegments((prev) => prev.map((s, idx) => (idx === i ? { ...s, text } : s)))

  const removeSeg = (i: number) =>
    setSegments((prev) => prev.filter((_, idx) => idx !== i))

  return (
    <div className="container-app mx-auto max-w-4xl space-y-4 p-6" dir="rtl">
      <h1 className="font-display text-2xl font-extrabold">ترنسکریپت صدا و ویدیو</h1>
      <p className="text-sm text-ink-muted">
        فایل صوتی تا {MAX_AUDIO_MB}MB آپلود کن — متن زنده می‌آید، ادیت کن و SRT/VTT/TXT بگیر.
      </p>

      <div className="card space-y-3 p-4">
        <input
          type="file"
          accept="audio/*"
          disabled={busy}
          onChange={handleFile}
          className="block w-full text-sm text-ink-muted file:ml-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-700 disabled:opacity-50"
        />

        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-muted">سرعت:</span>
          {([1, 2, 4] as const).map((s) => (
            <button
              key={s}
              disabled={busy}
              onClick={() => setSpeed(s)}
              className={`rounded px-3 py-1 text-xs ${speed === s ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              {s}x
            </button>
          ))}
          {busy && (
            <button
              onClick={() => {
                stopRef.current = true
                tRef.current?.finish()
              }}
              className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
            >
              ⏹ توقف
            </button>
          )}
        </div>

        {busy && (
          <div className="h-2 w-full overflow-hidden rounded bg-gray-700">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
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
        <div className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-700 pb-3">
            <strong className="text-sm">ویرایش زیرنویس ({segments.length} سگمنت)</strong>
            <div className="flex gap-2">
              <button
                onClick={() => download(`${baseName}.srt`, toSrt(segments), 'text/plain')}
                className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
              >
                ⬇ SRT
              </button>
              <button
                onClick={() => download(`${baseName}.vtt`, toVtt(segments), 'text/vtt')}
                className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
              >
                ⬇ VTT
              </button>
              <button
                onClick={() => download(`${baseName}.txt`, toTxt(segments))}
                className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
              >
                ⬇ TXT
              </button>
            </div>
          </div>

          <div className="max-h-[32rem] space-y-2 overflow-y-auto">
            {segments.map((s, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-gray-800/50 p-2">
                <span className="mt-2 shrink-0 font-mono text-[11px] text-ink-muted">
                  {s.start.toFixed(1)}–{s.end.toFixed(1)}
                </span>
                <textarea
                  value={s.text}
                  onChange={(e) => updateText(i, e.target.value)}
                  rows={1}
                  className="w-full resize-y bg-transparent text-sm outline-none"
                />
                <button
                  onClick={() => removeSeg(i)}
                  className="mt-1 shrink-0 text-red-400 hover:text-red-300"
                  title="حذف"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
