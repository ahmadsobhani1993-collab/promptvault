'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@/lib/use-auth'
import { useVideoTranscribe } from '@/lib/use-video-transcribe'
import SubtitleStudio from './SubtitleStudio'
import SubtitleVideoExport from './SubtitleVideoExport'
import InstagramCaptionModal from '@/components/InstagramCaptionModal'
import { download, toSrt, toVtt, toTxt } from '@/lib/subtitle'
import MobileStudioLayout from '@/components/subtitle-studio/mobile/MobileStudioLayout'

const MAX_FILE_SIZE_MB = 250
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024 // 250 MB

export default function VideoSubtitleClient() {
  const auth = useAuth()
  const [videoUrl, setVideoUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [speed, setSpeed] = useState<1 | 2 | 4 | 8>(4)
  const [viewMode, setViewMode] = useState<'classic' | 'studio'>('studio')
  const [currentTime, setCurrentTime] = useState(0)

  const { status, progress, busy, segments, setSegments, run, stop } = useVideoTranscribe()

  const baseName = fileName.replace(/\.[^.]+$/, '') || 'video'

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isMov = file.name.toLowerCase().endsWith('.mov')
    if (!file.type.startsWith('video/') && !isMov) return

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(1)
      alert(`❌ حجم فایل انتخابی (${sizeInMB} مگابایت) بیش از سقف مجاز ۲۵۰ مگابایت است. لطفاً ویدیوی سبک‌تری انتخاب کنید.`)
      e.target.value = ''
      return
    }

    setFileName(file.name)
    setVideoUrl(URL.createObjectURL(file))
    await run(file, speed)
  }

  // به‌روزرسانی متن یک سگمنت از طریق ادیتور استودیو
  const handleUpdateSegmentText = (index: number, newText: string) => {
    setSegments((prev) => {
      const copy = [...prev]
      if (copy[index]) {
        copy[index] = { ...copy[index], text: newText }
      }
      return copy
    })
  }

  if (auth === 'checking')
    return <div className="p-10 text-center text-sm text-white/40">در حال بررسی…</div>

  if (auth === 'no')
    return (
      <div className="container-app py-16" dir="rtl">
        <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-line/60 bg-[#12100d]/90 p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-2xl shadow-inner">
            🔒
          </div>
          <h2 className="font-display text-xl md:text-2xl font-black text-white mb-3">
            ورود به حساب کاربری الزامی است
          </h2>
          <p className="text-xs md:text-sm text-stone-400 leading-relaxed mb-8 max-w-md mx-auto">
            برای استفاده از استودیو زیرنویس هوشمند، لطفاً وارد حساب کاربری خود شوید یا رایگان ثبت‌نام کنید.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold px-8 py-3 text-xs transition-all shadow-lg shadow-amber-500/20"
            >
              ورود به حساب
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto rounded-xl border border-white/10 bg-zinc-900 px-8 py-3 text-xs font-bold text-white hover:border-amber-500/50 hover:text-amber-400 transition-all"
            >
              ثبت‌نام رایگان
            </Link>
          </div>
        </div>
      </div>
    )

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 lg:p-6" dir="rtl">
      {/* ─── Top Bar ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-extrabold text-white lg:text-xl">🎬 استودیو زیرنویس هوشمند</h1>
          <p className="mt-0.5 max-w-[60vw] truncate text-[11px] text-white/40" title={fileName}>{baseName}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* سوییچر بین حالت استودیوی پیشرفته و کلاسیک (قابل استفاده در دسکتاپ و موبایل) */}
          <div className="flex items-center rounded-xl border border-white/10 bg-zinc-900/80 p-1">
            <button
              onClick={() => setViewMode('studio')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                viewMode === 'studio'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <span>📱</span>
              <span>استودیو پیشرفته</span>
            </button>
            <button
              onClick={() => setViewMode('classic')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                viewMode === 'classic'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <span>🖥️</span>
              <span>نمای کلاسیک</span>
            </button>
          </div>

          <Link href="/transcribe" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 transition hover:border-amber-500/40 hover:text-amber-300">
            🎙 تبدیل صوت
          </Link>
        </div>
      </div>

      {/* ─── Import / Status strip ─── */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-black transition hover:bg-amber-400">
            {videoUrl ? '🎞 تغییر ویدیو' : '📥 وارد کردن ویدیو'}
            <input type="file" accept="video/*,.mov,.mp4,.mkv,.webm" disabled={busy} onChange={handleFile} className="hidden" />
          </label>

          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-1">
            <span className="px-2 text-[10px] text-white/40">سرعت</span>
            {([1, 2, 4, 8] as const).map((s) => (
              <button
                key={s}
                disabled={busy}
                onClick={() => setSpeed(s)}
                className={`rounded-lg px-2.5 py-1 text-[11px] transition ${speed === s ? 'bg-amber-500 font-bold text-black' : 'text-white/60 hover:bg-white/10'}`}
              >
                {s}x
              </button>
            ))}
          </div>

          {busy && (
            <button onClick={stop} className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2 text-xs text-red-400 transition hover:bg-red-500/20">
              ⏹ توقف
            </button>
          )}

          <div className="ms-auto flex items-center gap-2 text-[11px] text-white/40">
            <span className="hidden text-[10px] text-white/30 md:inline">حداکثر ۲۵۰ مگابایت</span>
            {segments.length > 0 && <span className="hidden sm:inline">💾 ذخیره خودکار</span>}
            {segments.length > 0 && <span className="rounded-md bg-white/5 px-2 py-1">{segments.length} سگمنت</span>}
          </div>
        </div>

        {busy && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        {status && (
          <div
            className={`mt-3 rounded-xl px-3 py-2 text-xs ${
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
          {/* نمایش شرطی بین استودیو پیشرفته و نمای کلاسیک بر اساس انتخاب کاربر */}
          {viewMode === 'studio' ? (
            <div className="py-2">
              <MobileStudioLayout
                videoUrl={videoUrl}
                subtitles={segments}
                onUpdateSubtitleText={handleUpdateSegmentText}
                currentTime={currentTime}
                onSeek={(t) => setCurrentTime(t)}
                onExport={() => {
                  const exportEl = document.getElementById('export-panel')
                  exportEl?.scrollIntoView({ behavior: 'smooth' })
                }}
              />
            </div>
          ) : (
            <SubtitleStudio videoUrl={videoUrl} segments={segments} setSegments={setSegments} />
          )}

          {/* ─── Output Panel (همان لاجیک قبلی بدون تغییر) ─── */}
          <div id="export-panel" className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <strong className="text-sm font-bold text-white/90">خروجی و دانلود</strong>
              <span className="text-[11px] text-white/40">دانلود مستقیم فایل یا رندر ویدیو با زیرنویس چسبیده</span>
            </div>
            
            <div className="mb-4 flex flex-wrap gap-2">
              <button onClick={() => download(`${baseName}.srt`, toSrt(segments), 'text/plain')} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white/80 transition hover:border-amber-500/40 hover:text-amber-300">
                📄 دانلود فایل SRT
              </button>
              <button onClick={() => download(`${baseName}.vtt`, toVtt(segments), 'text/vtt')} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white/80 transition hover:border-amber-500/40 hover:text-amber-300">
                📄 دانلود فایل VTT
              </button>
              <button onClick={() => download(`${baseName}.txt`, toTxt(segments))} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white/80 transition hover:border-amber-500/40 hover:text-amber-300">
                📝 متن خام (TXT)
              </button>
            </div>

            <SubtitleVideoExport
              segments={segments}
              videoUrl={videoUrl}
              fileName={baseName}
            />

            {segments && segments.length > 0 && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                <InstagramCaptionModal
                  sourceText={segments.map((s) => s.text).join(' ')}
                  locale="fa"
                />
              </div>
            )}
          </div>
        </>
      ) : (
        /* ─── Empty State ─── */
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-white/10 bg-zinc-900/30 py-20 text-center">
          <div className="text-5xl">🎬</div>
          <div>
            <p className="text-base font-bold text-white/90">ویدیو را وارد کنید</p>
            <p className="mt-1 text-xs text-white/40">استخراج خودکار گفتار → انتخاب استایل و کادر دلخواه → رندر نهایی</p>
          </div>
        </div>
      )}
    </div>
  )
}
