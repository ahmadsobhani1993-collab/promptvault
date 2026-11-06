'use client'

import { useVideoExport } from './export/useVideoExport'
import type { Seg, Style } from '@/lib/subtitle-studio'
import { useLocale } from '@/lib/use-locale'
import { L } from '@/lib/l'

interface Props {
  videoUrl: string
  sourceFile?: File | Blob | null
  segments: Seg[]
  style: Style
  baseName?: string
}

export default function SubtitleVideoExport({ videoUrl, sourceFile, segments, style, baseName = 'video' }: Props) {
  const locale = useLocale()
  const isEn = locale === 'en'
  const { exporting, progress, stageText, exportVideo, cancelExport } = useVideoExport(sourceFile)

  return (
    <div className="space-y-4">
      <p className="text-center text-xs leading-6 text-stone-400">
        {L(locale, 'تصویر با همان موتور پیش‌نمایش رندر و زمان‌بندی آن با صدای اصلی همگام می‌شود.', 'Video is rendered with the preview renderer and its timing is synchronized to the original audio.')}
      </p>
      {exporting ? (
        <div className="space-y-3">
          <div className="flex justify-between gap-3 text-xs">
            <span className="text-amber-300">{stageText || L(locale, 'در حال رندر…', 'Rendering…')}</span>
            <span className="font-mono text-stone-400">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-stone-800">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <button type="button" onClick={cancelExport} className="w-full rounded-xl border border-red-500/30 bg-red-500/10 py-2 text-xs font-bold text-red-300">
            {L(locale, 'لغو خروجی', 'Cancel export')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!videoUrl || !segments.length}
          onClick={() => exportVideo(videoUrl, segments, style, baseName)}
          className="w-full rounded-xl bg-amber-500 py-3 text-xs font-black text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {L(locale, 'شروع رندر و دانلود MP4', 'Render and download MP4')}
        </button>
      )}
    </div>
  )
}
