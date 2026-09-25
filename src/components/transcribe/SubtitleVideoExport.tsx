'use client'

import { useEffect } from 'react'
import { loadFont, type Seg, type Style } from '@/lib/subtitle-studio'
import { useVideoExport, getOrInitFFmpeg, readStoredStyle } from './export/useVideoExport'

type Props = {
  videoUrl: string
  baseName?: string
  segments: Seg[]
  style?: Style
}

export default function SubtitleVideoExport({ videoUrl, baseName = 'video', segments, style }: Props) {
  const { exporting, progress, status, eta, exportVideo, cancelExport } = useVideoExport(
    videoUrl,
    baseName,
    segments,
    style
  )

  useEffect(() => {
    const s = style || readStoredStyle()
    if (s?.fontId) loadFont(s.fontId).catch(() => {})
    getOrInitFFmpeg().catch(() => {})
  }, [style])

  const isReady = Boolean(videoUrl && segments && segments.length > 0)

  return (
    <div className="relative mt-4 w-full rounded-2xl border border-white/10 bg-black/40 p-4">
      {exporting ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-white">{status}</span>
            <div className="flex items-center gap-2">
              {eta && <span className="text-amber-400 font-mono">{eta}</span>}
              <button
                type="button"
                onClick={cancelExport}
                className="rounded-lg border border-red-500/40 bg-red-500/20 px-2.5 py-1 text-red-300 transition hover:bg-red-500/30"
              >
                ✕ لغو رندر
              </button>
            </div>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-amber-500 transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-mono text-gray-300 text-left">{progress}%</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={exportVideo}
          disabled={exporting || !isReady}
          className={`w-full rounded-xl py-3.5 font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
            !isReady
              ? 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50 shadow-none'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400 cursor-pointer active:scale-[0.99]'
          }`}
        >
          <span>📹</span>
          <span>
            {!videoUrl
              ? 'ابتدا ویدیو را بارگذاری کنید'
              : !segments || segments.length === 0
              ? 'در انتظار پردازش و تکمیل زیرنویس...'
              : 'خروجی MP4 با زیرنویس'}
          </span>
        </button>
      )}
    </div>
  )
}
