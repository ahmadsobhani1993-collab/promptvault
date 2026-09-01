'use client'

import { useRef, useState } from 'react'
import { LiveTranscriber, TranscriptSegment, getGeminiKey } from '@/lib/live-transcribe'
import { decodeToPcm16k, MAX_AUDIO_MB } from '@/lib/audio'
import { prepareChunks } from '@/lib/audio-enhance'
import SubtitleStudio from './SubtitleStudio'

const MAX_VIDEO_MB = 200

type Mode = 'audio' | 'video'

export default function TranscribeClient() {
  const [mode, setMode] = useState<Mode>('audio')
  const [status, setStatus] = useState('')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [fileName, setFileName] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [speed, setSpeed] = useState<1 | 2 | 4 | 8>(4)
  const stopRef = useRef(false)
  const tRef = useRef<LiveTranscriber | null>(null)

  const baseName = fileName.replace(/\.[^.]+$/, '') || 'transcript'
  const maxMb = mode === 'video' ? MAX_VIDEO_MB : MAX_AUDIO_MB

  const switchMode = (m: Mode) => {
    if (busy) return
    setMode(m)
    setStatus('')
    setSegments([])
    setFileName('')
    setProgress(0)
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)

    const isAudio = file.type.startsWith('audio/')
    const isVideo = file.type.startsWith('video/')
    if ((mode === 'audio' && !isAudio) || (mode === 'video' && !isVideo)) {
      setStatus(mode === 'audio' ? '❌ در این بخش فقط فایل صوتی مجاز است' : '❌ در این بخش فقط فایل ویدیویی مجاز است')
      return
    }

    if (file.size > maxMb * 1024 * 1024) {
      setStatus(`❌ فایل بزرگ‌تر از ${maxMb}MB است`)
      return
    }

    setSegments([])
    setProgress(0)
    setBusy(true)
    stopRef.current = false

    if (isVideo) setVideoUrl(URL.createObjectURL(file))
    else setVideoUrl('')

    try {
      setStatus('۱. دیکود و بهینه‌سازی صدا…')
      const pcm = await decodeToPcm16k(file)
      const { chunks, avg } = await prepareChunks(pcm)
      console.log('[audio] avg amplitude:', avg)

      if (avg < 0.001) {
        setStatus('❌ این فایل صدای قابل استفاده ندارد (سکوت) — فایل با گفتار واضح امتحان کن')
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
        setStatus('✅ تمام شد — در استودیو زیرنویس، ادیت و خروجی بگیر')
      }
    } catch (err: any) {
      console.error('[transcribe]', err)
      setStatus('❌ ' + (err?.message || String(err)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container-app mx-auto max-w-4xl space-y-4 p-6" dir="rtl">
      <h1 className="font-display text-2xl font-extrabold">ترنسکریپت صدا و ویدیو</h1>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => switchMode('audio')}
          disabled={busy}
          className={`rounded-xl p-4 text-right transition ${mode === 'audio' ? 'bg-blue-600 text-white' : 'card hover:bg-gray-800'}`}
        >
          <div className="text-base font-bold">🎙️ تبدیل فایل صوتی به متن</div>
          <div className={`mt-1 text-xs ${mode === 'audio' ? 'text-blue-100' : 'text-ink-muted'}`}>
            MP3/WAV/M4A تا {MAX_AUDIO_MB}MB — خروجی متن
          </div>
        </button>
        <button
          onClick={() => switchMode('video')}
          disabled={busy}
          className={`rounded-xl p-4 text-right transition ${mode === 'video' ? 'bg-blue-600 text-white' : 'card hover:bg-gray-800'}`}
        >
          <div className="text-base font-bold">🎬 ساخت زیرنویس از ویدیو</div>
          <div className={`mt-1 text-xs ${mode === 'video' ? 'text-blue-100' : 'text-ink-muted'}`}>
            MP4/WebM تا {MAX_VIDEO_MB}MB — SRT/VTT + ویدیو با زیرنویس
          </div>
        </button>
      </div>

      <div className="card space-y-3 p-4">
        <input
          type="file"
          accept={mode === 'audio' ? 'audio/*' : 'video/*'}
          disabled={busy}
          onChange={handleFile}
          className="block w-full text-sm text-ink-muted file:ml-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-700 disabled:opacity-50"
        />

        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-muted">سرعت:</span>
          {([1, 2, 4, 8] as const).map((s) => (
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
              : status.startsWith('⚠️')
              ? 'bg-yellow-500/10 text-yellow-400'
              : 'bg-blue-500/10 text-blue-400'
          }`}
        >
          {status}
        </div>
      )}

      {mode === 'video' && videoUrl && segments.length > 0 && (
        <SubtitleStudio videoUrl={videoUrl} baseName={baseName} segments={segments} onChange={setSegments} />
      )}

      {mode === 'audio' && segments.length > 0 && (
        <div className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-700 pb-3">
            <strong className="text-sm">ویرایش متن ({segments.length} سگمنت)</strong>
            <button
              onClick={() => {
                const txt = segments.map((s) => s.text).join('\n')
                const blob = new Blob(['\uFEFF' + txt], { type: 'text/plain;charset=utf-8' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = `${baseName}.txt`
                a.click()
                setTimeout(() => URL.revokeObjectURL(a.href), 5000)
              }}
              className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
            >
              ⬇ TXT
            </button>
          </div>
          <div className="max-h-[32rem] space-y-2 overflow-y-auto">
            {segments.map((s, i) => (
              <textarea
                key={i}
                value={s.text}
                onChange={(e) => setSegments(segments.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)))}
                rows={1}
                className="w-full resize-y rounded-lg bg-gray-800/50 p-2 text-sm outline-none"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
