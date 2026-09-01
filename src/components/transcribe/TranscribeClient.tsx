'use client'

import { useRef, useState } from 'react'
import { LiveTranscriber, TranscriptSegment, getGeminiKey } from '@/lib/live-transcribe'
import { decodeToPcm16k, bufferToBase64Chunks, MAX_AUDIO_MB } from '@/lib/audio'
import { toSrt, toVtt, toTxt, download } from '@/lib/subtitle'

const MAX_VIDEO_MB = 200

type Mode = 'audio' | 'video'

export default function TranscribeClient() {
  const [mode, setMode] = useState<Mode>('audio')
  const [status, setStatus] = useState('')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [fileName, setFileName] = useState('')
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

    try {
      setStatus('۱. دیکود صدا (مرورگر)…')
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
        setStatus(
          segments.length === 0
            ? '⚠️ متنی دریافت نشد — با سرعت 1x دوباره تلاش کن'
            : '✅ تمام شد — متن را ادیت و خروجی بگیر'
        )
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

      {/* دو تب مجزا */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => switchMode('audio')}
          disabled={busy}
          className={`rounded-xl p-4 text-right transition ${
            mode === 'audio' ? 'bg-blue-600 text-white' : 'card hover:bg-gray-800'
          }`}
        >
          <div className="text-base font-bold">🎙️ تبدیل فایل صوتی به متن</div>
          <div className={`mt-1 text-xs ${mode === 'audio' ? 'text-blue-100' : 'text-ink-muted'}`}>
            MP3/WAV/M4A تا {MAX_AUDIO_MB}MB — خروجی متن
          </div>
        </button>
        <button
          onClick={() => switchMode('video')}
          disabled={busy}
          className={`rounded-xl p-4 text-right transition ${
            mode === 'video' ? 'bg-blue-600 text-white' : 'card hover:bg-gray-800'
          }`}
        >
          <div className="text-base font-bold">🎬 ساخت زیرنویس از ویدیو</div>
          <div className={`mt-1 text-xs ${mode === 'video' ? 'text-blue-100' : 'text-ink-muted'}`}>
            MP4/WebM تا {MAX_VIDEO_MB}MB — خروجی SRT/VTT
          </div>
        </button>
      </div>

      <div className="card space-y-3 p-4">
        <input
          type="file"
          accept={mode === 'audio' ? 'audio/*' : 'video/*'}
          disabled={busy}
          onChange={handleFile}
          className="block w-full text-sm text-ink-muted file:ml-
