'use client'

import React, { useRef } from 'react'
import { CaptionSegment } from '@/lib/studio/types'
import { exportSRT, parseSRT } from '@/lib/studio/srt-parser'

interface Props {
  onClose: () => void
  onExportClick: () => void
  onTranslateClick: () => void
  segments: CaptionSegment[]
  onImportSRT: (segments: CaptionSegment[]) => void
}

export default function StudioHeader({
  onClose,
  onExportClick,
  onTranslateClick,
  segments,
  onImportSRT,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (text) {
        const parsed = parseSRT(text)
        if (parsed.length > 0) {
          onImportSRT(parsed)
        }
      }
    }
    reader.readAsText(file)
  }

  const handleDownloadSRT = () => {
    if (!segments.length) return
    const content = exportSRT(segments)
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'subtitles.srt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-stone-800 bg-[#0d0c0a] px-4 select-none">
      {/* سمت چپ: دکمه خروج */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 border border-stone-800 text-stone-400 hover:text-white hover:border-stone-700 transition"
          title="خروج از استودیو"
        >
          ✕
        </button>
      </div>

      {/* وسط: ابزارهای مدیریت SRT و ترجمه */}
      <div className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          accept=".srt"
          className="hidden"
          onChange={handleFileUpload}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-xl border border-stone-800 bg-stone-900/90 px-3 py-1.5 text-xs font-bold text-stone-300 hover:border-amber-500/40 hover:text-amber-400 transition"
        >
          <span>📥</span>
          <span>وارد کردن SRT</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadSRT}
          className="flex items-center gap-1.5 rounded-xl border border-stone-800 bg-stone-900/90 px-3 py-1.5 text-xs font-bold text-stone-300 hover:border-amber-500/40 hover:text-amber-400 transition"
        >
          <span>📤</span>
          <span>دانلود SRT</span>
        </button>

        <button
          type="button"
          onClick={onTranslateClick}
          className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/20 transition"
        >
          <span>🌐</span>
          <span>ترجمه FA ⇄ EN</span>
        </button>
      </div>

      {/* سمت راست: دکمه اکسپورت نارنجی مرجع */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onExportClick}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2 text-xs font-black text-black shadow-lg shadow-orange-500/25 hover:from-orange-400 hover:to-amber-400 active:scale-95 transition"
        >
          <span>خروجی نهایی</span>
          <span>⚡</span>
        </button>
      </div>
    </header>
  )
}
