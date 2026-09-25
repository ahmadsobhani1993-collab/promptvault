'use client'

import React from 'react'
import { CaptionSegment } from '@/lib/studio/types'

interface Props {
  currentTime: number
  duration: number
  isPlaying: boolean
  onTogglePlay: () => void
  onSeek: (time: number) => void
  segments: CaptionSegment[]
  selectedSegmentId: string | null
  onSelectSegment: (id: string) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

function formatSec(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec < 10 ? '0' : ''}${sec}`
}

export default function StudioTimeline({
  currentTime,
  duration,
  isPlaying,
  onTogglePlay,
  onSeek,
  segments,
  selectedSegmentId,
  onSelectSegment,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: Props) {
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex flex-col border-t border-stone-800 bg-[#0d0c0a] p-3 select-none">
      {/* ردیف بالا: کنترل‌های اصلی، زمان و Undo/Redo */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-black font-black text-sm hover:bg-amber-400 active:scale-95 transition"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          <span className="font-mono text-xs text-stone-300">
            {formatSec(currentTime)} <span className="text-stone-600">/</span> {formatSec(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="rounded-xl border border-stone-800 bg-stone-900/80 px-3 py-1.5 text-xs text-stone-300 disabled:opacity-40 hover:border-stone-700 transition"
            title="Undo"
          >
            ↩ واگرد
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="rounded-xl border border-stone-800 bg-stone-900/80 px-3 py-1.5 text-xs text-stone-300 disabled:opacity-40 hover:border-stone-700 transition"
            title="Redo"
          >
            ردگرد ↪
          </button>
        </div>
      </div>

      {/* ترک Timeline با نشانگر زنده و سگمنت‌ها */}
      <div
        className="relative h-14 w-full rounded-xl bg-[#14120f] border border-stone-800/80 cursor-pointer overflow-hidden p-1.5 flex items-center"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const clickX = e.clientX - rect.left
          const newTime = (clickX / rect.width) * duration
          onSeek(newTime)
        }}
      >
        {/* قطعه‌های کپشن روی ترک */}
        {segments.map((seg) => {
          const leftPercent = duration > 0 ? (seg.start / duration) * 100 : 0
          const widthPercent = duration > 0 ? Math.max(2, ((seg.end - seg.start) / duration) * 100) : 0
          const isSelected = selectedSegmentId === seg.id

          return (
            <div
              key={seg.id}
              onClick={(e) => {
                e.stopPropagation()
                onSelectSegment(seg.id)
                onSeek(seg.start)
              }}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
              }}
              className={`absolute top-2 bottom-2 truncate rounded-lg px-2 text-[10px] font-bold flex items-center transition border ${
                isSelected
                  ? 'bg-amber-500/30 border-amber-400 text-amber-200 z-20 shadow-md'
                  : 'bg-stone-800/80 border-stone-700 text-stone-300 hover:border-stone-500 z-10'
              }`}
            >
              {seg.text}
            </div>
          )
        })}

        {/* سوزن پخش (Playhead) */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-30 pointer-events-none shadow-[0_0_8px_#f59e0b]"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="h-2 w-2 -ml-[3px] rounded-full bg-amber-400" />
        </div>
      </div>
    </div>
  )
}
