'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@/lib/use-auth'
import { useVideoTranscribe } from '@/lib/use-video-transcribe'
import SubtitleStudio from './SubtitleStudio'
import SubtitleVideoExport from './SubtitleVideoExport'
import { download } from '@/lib/subtitle'
import { toSrt, toVtt, toTxt } from '@/lib/subtitle'

export default function VideoSubtitleClient() {
  const auth = useAuth()
  const [videoUrl, setVideoUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [speed, setSpeed] = useState<1 | 2 | 4 | 8>(4)
  const { status, progress, busy, segments, setSegments, run, stop } = useVideoTranscribe()

  const baseName = fileName.replace(/\.[^.]+$/, '') || 'video'

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('video/')) return
    setFileName(file.name)
    setVideoUrl(URL.createObjectURL(file))
    await run(file, speed)
  }

  if (auth === 'checking') return <div className="p-10 text-center text-sm text-ink-muted">در حال بررسی…</div>
  if (auth === 'no') {
    return (
      <div className="container-app mx-auto max-w-3xl p-6" dir="rtl">
        <div className="space-y-4 rounded-2xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 p-8 text-center">
          <p className="text-sm text-ink-muted">برای استفاده از استودیو زیرنویس، ابتدا باید وارد حساب کاربری خود شوید.</p>
          <Link href="/login" className="inline-block rounded-xl border border-amber-500/60 px-6 py-2.5 text-sm text-amber-400 transition hover:bg-amber-500/10">ورود به حساب کاربری</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container-app mx-auto max-w-6xl space-y-4 p-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-extrabold">🎬 استودیو زیرنویس — {baseName}</h1>
        <Link href="/transcribe" className="rounded bg-gray-700 px-2 py-1 hover:bg-gray-600 text-xs">🎙 صدا به متن</Link>
      </div>

      <div className="card space-y-2 p-3">
        <input type="file" accept="video/*" disabled={busy} onChange={handleFile}
          className="block w-full text-sm text-ink-muted file:ml-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-700 disabled:opacity-50" />
        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-muted">سرعت:</span>
          {([1, 2, 4, 8] as const).map((s) => (
            <button key={s} disabled={busy} onClick={() => setSpeed(s)}
              className={`rounded px-3 py-1 text-xs ${speed === s ? 'bg-blue-600 text-white' : 'bg-gray-700'}`}>{s}x</button>
          ))}
          {busy && <button onClick={stop} className="rounded bg-red-600 px-3 py-1 text-xs text-white">⏹ توقف</button>}
        </div>
        {busy && (
          <div className="h-2 w-full overflow-hidden rounded bg-gray-700">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {status && (
          <div className={`rounded-lg p-2 text-xs ${status.startsWith('✅') ? 'bg-green-500/10 text-green-400' : status.startsWith('❌') ? 'bg-red-500/10 text-red-400' : status.startsWith('⚠️') ? 'bg-yellow-500/10 text-yellow-400' : 'bg-blue-500/10 text-blue-400'}`}>{status}</div>
        )}
      </div>

      {videoUrl && (
        <>
          <SubtitleStudio videoUrl={videoUrl} segments={segments} setSegments={setSegments} />
          <div className="card space-y-2 p-3">
            <strong className="text-sm block">خروجی</strong>
            <button onClick={() => download(`${baseName}.srt`, toSrt(segments), 'text/plain')} className="block w-full rounded bg-blue-600 px-3 py-2 text-xs text-white">⬇ SRT</button>
            <button onClick={() => download(`${baseName}.vtt`, toVtt(segments), 'text/vtt')} className="block w-full rounded bg-blue-600 px-3 py-2 text-xs text-white">⬇ VTT</button>
            <button onClick={() => download(`${baseName}.txt`, toTxt(segments))} className="block w-full rounded bg-gray-700 px-3 py-2 text-xs">⬇ TXT</button>
            <SubtitleVideoExport videoUrl={videoUrl} baseName={baseName} segments={segments} style={{ fontId: 'Vazirmatn', size: 6, color: '#ffffff', bgOpacity: 0.55, outline: true, x: null, y: null, karaoke: true, hlColor: '#ffe14d' }} />
            <p className="text-[11px] leading-5 text-ink-muted">
              میان‌برها: Space پخش/توقف • ← → پرش ۱ ثانیه • Ctrl+Z Undo • Ctrl+Shift+Z Redo
            </p>
          </div>
        </>
      )}
    </div>
  )
}
