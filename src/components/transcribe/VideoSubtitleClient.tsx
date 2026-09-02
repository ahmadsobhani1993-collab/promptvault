'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@/lib/use-auth'
import { useVideoTranscribe } from '@/lib/use-video-transcribe'
import SubtitleStudio from './SubtitleStudio'
import SubtitleVideoExport from './SubtitleVideoExport'
import { download, toSrt, toVtt, toTxt } from '@/lib/subtitle'

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

  if (auth === 'checking')
    return <div className="p-10 text-center text-sm text-white/40">در حال بررسی…</div>

  if (auth === 'no')
    return (
      <div className="container-app mx-auto max-w-3xl p-6" dir="rtl">
        <div className="space-y-4 rounded-2xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 p-8 text-center">
          <p className="text-sm text-white/60">برای استفاده از استودیو زیرنویس، ابتدا باید وارد حساب کاربری خود شوید.</p>
          <Link href="/login" className="inline-block rounded-xl border border-amber-500/60 px-6 py-2.5 text-sm text-amber-400 transition hover:bg-amber-500/10">
            ورود به حساب کاربری
          </Link>
        </div>
      </div>
    )

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 lg:p-6" dir="rtl">
      {/* ─── Top Bar ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-extrabold text-white lg:text-xl">🎬 استودیو زیرنویس</h1>
          <p className="mt-0.5 max-w-[60vw] truncate text-[11px] text-white/40" title={fileName}>{baseName}</p>
        </div>
        <Link href="/transcribe" className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-amber-500/40 hover:text-amber-300">
          🎙 تبدیل صوت به متن
        </Link>
      </div>

      {/* ─── Import / Status strip ─── */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-400">
            {videoUrl ? '🎞 تغییر ویدیو' : '📥 وارد کردن ویدیو'}
            <input type="file" accept="video/*" disabled={busy} onChange={handleFile} className="hidden" />
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
            <button onClick={stop} className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/20">
              ⏹ توقف
            </button>
          )}

          <div className="ms-auto flex items-center gap-2 text-[11px] text-white/40">
            {segments.length > 0 && <span className="hidden sm:inline">💾 ذخیره خودکار</span>}
            {segments.length > 0 && <span className="rounded-md bg-white/5 px-2 py-1">{segments.length} کپشن</span>}
          </div>
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

      {videoUrl ? (
        <>
          <SubtitleStudio videoUrl={videoUrl} segments={segments} setSegments={setSegments} />

          {/* ─── Output Panel ─── */}
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <strong className="text-sm text-white/80">خروجی</strong>
              <span className="text-[10px] text-white/40">فایل زیرنویس یا ویدیوی نهایی</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <button onClick={() => download(`${baseName}.srt`, toSrt(segments), 'text/plain')} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 transition hover:border-amber-500/40 hover:text-amber-300">SRT</button>
              <button onClick={() => download(`${baseName}.vtt`, toVtt(segments), 'text/vtt')} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 transition hover:border-amber-500/40 hover:text-amber-300">VTT</button>
              <button onClick={() => download(`${baseName}.txt`, toTxt(segments))} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 transition hover:border-amber-500/40 hover:text-amber-300">TXT</button>
            </div>
            <SubtitleVideoExport videoUrl={videoUrl} baseName={baseName} segments={segments} />
          </div>
        </>
      ) : (
        /* ─── Empty State ─── */
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-white/10 bg-zinc-900/30 py-20 text-center">
          <div className="text-4xl">🎬</div>
          <div>
            <p className="text-sm font-bold text-white/80">ویدیو را وارد کن</p>
            <p className="mt-1 text-xs text-white/40">ترنسکریپت خودکار → ویرایش کپشن → خروجی با زیرنویس</p>
          </div>
        </div>
      )}
    </div>
  )
}
