'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@/lib/use-auth'
import { useVideoTranscribe } from '@/lib/use-video-transcribe'
import SubtitleStudio from './SubtitleStudio'

const MAX_FILE_SIZE_MB = 250
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

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
    const isMov = file.name.toLowerCase().endsWith('.mov')
    if (!file.type.startsWith('video/') && !isMov) return

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(1)
      alert(`❌ حجم فایل انتخابی (${sizeInMB} مگابایت) بیش از سقف مجاز است.`)
      e.target.value = ''
      return
    }

    setFileName(file.name)
    setVideoUrl(URL.createObjectURL(file))
    await run(file, speed)
  }

  if (auth === 'checking')
    return <div className="p-10 text-center text-sm text-white/40">در حال بررسی…</div>

  if (auth === 'no')
    return (
      <div className="container-app py-16" dir="rtl">
        <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#12100d]/90 p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-2xl shadow-inner">
            🔒
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white mb-3">ورود به حساب کاربری الزامی است</h2>
          <p className="text-xs md:text-sm text-stone-400 leading-relaxed mb-8 max-w-md mx-auto">
            برای استفاده از استودیو زیرنویس، لطفاً وارد حساب خود شوید.
          </p>
          <Link
            href="/login"
            className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold px-8 py-3 text-xs transition shadow-lg shadow-amber-500/20"
          >
            ورود به حساب کاربری
          </Link>
        </div>
      </div>
    )

  return (
    <div className="min-h-screen bg-[#070605] text-white flex flex-col p-4 md:p-6" dir="rtl">
      {!videoUrl ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full rounded-3xl border border-stone-800 bg-[#12100d] p-8 shadow-2xl">
            <div className="h-16 w-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl">
              🎬
            </div>
            <h2 className="text-lg font-black text-white mb-2">ویدیوی خود را وارد کنید</h2>
            <p className="text-xs text-stone-400 leading-relaxed mb-6">
              فایل ویدیوی خود را انتخاب کنید تا با هوش مصنوعی ترنسکرایب و زیرنویس آن آماده شود.
            </p>

            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="text-[11px] text-stone-400">سرعت پردازش:</span>
              {([1, 2, 4, 8] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    speed === s ? 'bg-amber-500 text-black' : 'bg-stone-900 border border-stone-800 text-stone-400'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <label className="block w-full cursor-pointer rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-xs font-black text-black shadow-lg shadow-orange-500/20 active:scale-95 transition">
              انتخاب ویدیو از سیستم
              <input type="file" accept="video/*,.mov,.mp4" onChange={handleFile} className="hidden" />
            </label>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-6xl mx-auto space-y-4">
          {busy && (
            <div className="bg-stone-900/90 border border-amber-500/40 p-3 rounded-2xl backdrop-blur-md">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-amber-400 font-bold">{status || 'در حال ترنسکرایب...'}</span>
                <button onClick={stop} className="text-red-400 text-[10px] bg-red-500/10 px-2 py-0.5 rounded">
                  توقف
                </button>
              </div>
              <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <SubtitleStudio
            videoUrl={videoUrl}
            baseName={baseName}
            segments={segments as any}
            setSegments={setSegments}
          />
        </div>
      )}
    </div>
  )
}
