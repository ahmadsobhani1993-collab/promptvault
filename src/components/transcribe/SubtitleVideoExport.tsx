'use client'

import React from 'react'
import { StudioSegment, StudioStyleConfig } from '@/lib/studio/unified-style'
import { useVideoExport } from './export/useVideoExport'

interface Props {
  videoUrl: string
  baseName?: string
  segments: StudioSegment[]
  styleConfig: StudioStyleConfig
}

export default function SubtitleVideoExport({
  videoUrl,
  baseName = 'video',
  segments,
  styleConfig,
}: Props) {
  const { exporting, progress, status, exportVideo, cancelExport } = useVideoExport(
    videoUrl,
    baseName,
    segments,
    styleConfig
  )

  const isReady = Boolean(videoUrl && segments && segments.length > 0)

  return (
    <div className="w-full select-none" dir="rtl">
      {exporting ? (
        <div className="flex flex-col gap-3 p-4 bg-stone-900 rounded-2xl border border-stone-800">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-white">{status}</span>
            <button
              type="button"
              onClick={cancelExport}
              className="text-red-400 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 text-xs hover:bg-red-500/20"
            >
              لغو
            </button>
          </div>
          <div className="w-full h-3 bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-left font-mono text-xs text-stone-400">{progress}%</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={exportVideo}
          disabled={!isReady}
          className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition shadow-xl ${
            !isReady
              ? 'bg-stone-900 text-stone-600 border border-stone-800 cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 active:scale-98 shadow-amber-500/20 cursor-pointer'
          }`}
        >
          <span>⚡</span>
          <span>دریافت ویدیوی نهایی MP4</span>
        </button>
      )}
    </div>
  )
}
