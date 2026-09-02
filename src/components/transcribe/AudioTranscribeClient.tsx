'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { LiveTranscriber, TranscriptSegment } from '@/lib/live-transcribe'
import { decodeToPcm16k, MAX_AUDIO_MB } from '@/lib/audio'
import { prepareChunks } from '@/lib/audio-enhance'
import { toSrt, toTxt } from '@/lib/subtitle'
import { useAuth } from '@/lib/use-auth'
import AuthGate from './AuthGate'

const fmt = (t: number) => {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function AudioTranscribeClient() {
  const auth = useAuth()

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
      const t = new LiveTranscriber()
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

  if (auth === 'checking') return <div className="p-10 text-center text-sm text-white/40">در حال بررسی…</div>
  if (auth === 'no') return <AuthGate />

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 lg:p-6" dir="rtl">
      {/* ─── Top Bar ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-extrabold text-white lg:text-xl">🎙️ تبدیل فایل صوتی به متن</h1>
          <p className="mt-0.5 max-w-[60vw] truncate text-[11px] text-white/40" title={fileName}>
            {fileName || 'MP3 / WAV / M4A — تا ' + MAX_AUDIO_MB + 'MB'}
          </p>
        </div>
        <Link href="/subtitle" className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-amber-500/40 hover:text-amber-300">
          🎬 استودیو زیرنویس ویدیو
        </Link>
      </div>

      {/* ─── Import / Status strip ─── */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-400">
            📥 وارد کردن فایل صوتی
            <input type="file" accept="audio/*" disabled={busy} onChange={handleFile} className="hidden" />
          </label>

          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 p-1">
            <span className="px-2 text-[10px] text-white/40">سرعت</span>
            {([1, 2, 4, 8] as const).map((s) => (
              <button
                key={s}
                disabled={busy}
                onClick={() => setSpeed(s)}
                className={`rounded-md px-2.5 py-1 text-[11px] transition ${speed === s ? 'bg-amber-500 font-bold text-black' : 'text-white/60 hover:bg-white/10'}`}
              >
                {s}x
              </button>
            ))}
          </div>

          {busy && (
            <button
              onClick={() => { stopRef.current = true; tRef.current?.finish() }}
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/20"
            >
              ⏹ توقف
            </button>
          )}

          {segments.length > 0 && (
            <span className="ms-auto rounded-md bg-white/5 px-2 py-1 text-[11px] text-white/40">{segments.length} سگمنت</span>
          )}
        </div>

        {busy && (
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        {status && (
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-xs ${
              status.startsWith('✅')
                ? 'bg-emerald-500/10 text-emerald-400'
                : status.startsWith('❌')
                ? 'bg-red-500/10 text-red-400'
                : status.startsWith('⚠️')
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-white/5 text-white/60'
            }`}
          >
            {status}
          </div>
        )}
      </div>

      {/* ─── Empty State ─── */}
      {!busy && segments.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-white/10 bg-zinc-900/30 py-20 text-center">
          <div className="text-4xl">🎙️</div>
          <div>
            <p className="text-sm font-bold text-white/80">فایل صوتی را وارد کن</p>
            <p className="mt-1 text-xs text-white/40">ترنسکریپت زنده → ویرایش متن → خروجی TXT / SRT</p>
          </div>
        </div>
      )}

      {/* ─── Transcript + Output ─── */}
      {segments.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-zinc-900/60">
              <div className="border-b border-white/10 p-3 text-xs">
                <strong className="text-white/80">ویرایش متن ({segments.length} سگمنت)</strong>
              </div>
              <div className="max-h-[30rem] flex-1 space-y-1 overflow-y-auto p-2">
                {segments.map((s, i) => (
                  <div key={i} className="rounded-xl border-r-2 border-transparent p-2.5 transition hover:bg-white/5">
                    <span className="font-mono text-[10px] text-white/40">{fmt(s.start)}</span>
                    <textarea
                      value={s.text}
                      rows={1}
                      onChange={(e) => setSegments(segments.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)))}
                      className="mt-1 w-full resize-y bg-transparent text-sm leading-6 text-white/90 outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <strong className="mb-3 block text-sm text-white/80">خروجی</strong>
              <button
                onClick={() => dl(`${baseName}.txt`, toTxt(segments))}
                className="mb-2 block w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-400"
              >
                ⬇ دانلود TXT
              </button>
              <button
                onClick={() => dl(`${baseName}.srt`, toSrt(segments))}
                className="block w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 transition hover:border-amber-500/40 hover:text-amber-300"
              >
                ⬇ دانلود SRT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
