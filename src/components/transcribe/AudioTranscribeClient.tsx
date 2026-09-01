'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { LiveTranscriber, TranscriptSegment, getGeminiKey } from '@/lib/live-transcribe'
import { decodeToPcm16k, MAX_AUDIO_MB } from '@/lib/audio'
import { prepareChunks } from '@/lib/audio-enhance'
import { toSrt, toTxt } from '@/lib/subtitle'

export default function AudioTranscribeClient() {
  const [status, setStatus] = useState('')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [speed, setSpeed] = useState<1 | 2 | 4 | 8>(4)
  const stopRef = useRef(false)
  const tRef = useRef<LiveTranscriber | null>(null)

  const baseName = fileName.replace(/\.[^.]+$/, '') || 'transcript'

  const dl = (name: string, content: string, mime = 'text/plain') => {
    const blob = new Blob(['\uFEFF' + content], { type: mime + ';charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)

    if (!file.type.startsWith('audio/')) {
      setStatus('❌ فقط فایل صوتی — برای ویدیو به استودیو زیرنویس برو')
      return
    }
    if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
      setStatus(`❌ فایل بزرگ‌تر از ${MAX_AUDIO_MB}MB است`)
      return
    }

    setSegments([])
    setProgress(0)
    setBusy(true)
    stopRef.current = false

    try {
      setStatus('۱. دیکود و بهینه‌سازی صدا…')
      const pcm = await decodeToPcm16k(file)
      const { chunks, avg } = await prepareChunks(pcm)
      if (avg < 0.001) {
        setStatus('❌ این فایل صدای قابل استفاده ندارد (سکوت)')
        setBusy(false)
        return
      }

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
        setStatus('✅ تمام شد — متن را ادیت و خروجی بگیر')
      }
    } catch (err: any) {
      setStatus('❌ ' + (err?.message || String(err)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container-app mx-auto max-w-3xl space-y-4 p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">🎙️ تبدیل فایل صوتی به متن</h1>
        <Link href="/subtitle" className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700">
          🎬 استودیو زیرنویس ویدیو
        </Link>
      </div>

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
          {([1, 2, 4, 8] as const).map((s) => (
            <button key={s} disabled={busy} onClick={() => setSpeed(s)} className={`rounded px-3 py-1 text-xs ${speed === s ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>{s}x</button>
          ))}
          {busy && (
            <button onClick={() => { stopRef.current = true; tRef.current?.finish() }} className="rounded bg-red-600 px-3 py-1 text-xs text-white">⏹ توقف</button>
          )}
        </div>
        {busy && (
          <div className="h-2 w-full overflow-hidden rounded bg-gray-700">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {status && (
        <div className={`rounded-lg p-3 text-sm ${status.startsWith('✅') ? 'bg-green-500/10 text-green-400' : status.startsWith('❌') ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
          {status}
        </div>
      )}

      {segments.length > 0 && (
        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between border-b border-gray-700 pb-3">
            <strong className="text-sm">ویرایش متن ({segments.length} سگمنت)</strong>
            <div className="flex gap-2">
              <button onClick={() => dl(`${baseName}.txt`, toTxt(segments))} className="rounded bg-blue-600 px-3 py-1 text-xs text-white">⬇ TXT</button>
              <button onClick={() => dl(`${baseName}.srt`, toSrt(segments))} className="rounded bg-gray-700 px-3 py-1 text-xs">⬇ SRT</button>
            </div>
          </div>
          <div className="max-h-[32rem] space-y-2 overflow-y-auto">
            {segments.map((s, i) => (
              <textarea
                key={i}
                value={s.text}
                rows={1}
                onChange={(e) => setSegments(segments.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)))}
                className="w-full resize-y rounded-lg bg-gray-800/50 p-2 text-sm outline-none"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
