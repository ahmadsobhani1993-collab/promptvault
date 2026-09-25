'use client'

import React, { useRef, useState } from 'react'
import { CaptionSegment, StyleConfig, DenoiseSettings } from '@/lib/studio/types'
import SubtitleVideoExport from '@/components/transcribe/SubtitleVideoExport'

interface Props {
  videoUrl: string
  segments: CaptionSegment[]
  onUpdateSegments: (newSegments: CaptionSegment[]) => void
  styleConfig: StyleConfig
  onUpdateStyle: (patch: Partial<StyleConfig>) => void
  currentTime: number
  duration: number
  isPlaying: boolean
  onTogglePlay: () => void
  onSeek: (time: number) => void
  onTranslate: () => void
  onChangeVideo: () => void
  onSwitchToAdvanced: () => void
  denoiseSettings: DenoiseSettings
  onUpdateDenoise: (patch: Partial<DenoiseSettings>) => void
}

export default function ClassicDesktopView({
  videoUrl,
  segments,
  onUpdateSegments,
  styleConfig,
  onUpdateStyle,
  currentTime,
  duration,
  isPlaying,
  onTogglePlay,
  onSeek,
  onTranslate,
  onChangeVideo,
  onSwitchToAdvanced,
  denoiseSettings,
  onUpdateDenoise,
}: Props) {
  const [selectedSegId, setSelectedSegId] = useState<string | null>(segments[0]?.id || null)
  const [showExportModal, setShowExportModal] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleAdjustTime = (id: string, deltaStart: number, deltaEnd: number) => {
    const updated = segments.map((s) => {
      if (s.id !== id) return s
      const newStart = Math.max(0, s.start + deltaStart)
      const newEnd = Math.max(newStart + 0.2, s.end + deltaEnd)
      return { ...s, start: newStart, end: newEnd }
    })
    onUpdateSegments(updated)
  }

  const handleTextChange = (id: string, text: string) => {
    const updated = segments.map((s) => (s.id === id ? { ...s, text } : s))
    onUpdateSegments(updated)
  }

  const handleDeleteSeg = (id: string) => {
    onUpdateSegments(segments.filter((s) => s.id !== id))
  }

  const activeSegment = segments.find((s) => currentTime >= s.start && currentTime <= s.end) ||
    segments.find((s) => s.id === selectedSegId) || null

  return (
    <div className="flex flex-col h-screen w-full bg-[#0a0908] text-white overflow-hidden select-none" dir="rtl">
      {/* هدر بالایی */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-stone-800 bg-[#110f0d] z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-stone-900 border border-stone-800 rounded-xl p-1">
            <button
              type="button"
              className="px-4 py-1.5 rounded-lg text-xs font-black bg-amber-500 text-black shadow-md"
            >
              نمای کلاسیک
            </button>
            <button
              type="button"
              onClick={onSwitchToAdvanced}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-stone-400 hover:text-white transition"
            >
              استودیو پیشرفته
            </button>
          </div>
          <button
            type="button"
            onClick={onChangeVideo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-bold text-stone-200 transition"
          >
            <span>🔄</span>
            <span>تغییر ویدیو</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTranslate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition"
          >
            <span>🌐</span>
            <span>ترجمه هوشمند جمینای</span>
          </button>

          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black text-xs shadow-lg shadow-orange-500/20 active:scale-95 transition"
          >
            <span>خروجی نهایی MP4</span>
            <span>⚡</span>
          </button>
        </div>
      </div>

      {/* بدنه دو ستونه */}
      <div className="flex flex-1 overflow-hidden">
        {/* ستون راست: ویدیو با تشخیص هوشمند ابعاد */}
        <div className="flex-1 flex flex-col border-l border-stone-800 bg-black relative p-4 items-center justify-center">
          {/* نوار تنظیم کادر بالای ویدیو */}
          <div className="absolute top-4 flex items-center gap-2 bg-[#12100d]/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-stone-800 z-10">
            <span className="text-[11px] text-stone-400 font-bold ml-1">کادر:</span>
            {(['original', '16:9', '9:16', '1:1'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onUpdateStyle({ aspectRatio: r === 'original' ? undefined : (r as any) })}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  (!styleConfig.aspectRatio && r === 'original') || styleConfig.aspectRatio === r
                    ? 'bg-amber-500 text-black'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                {r === 'original' ? 'اصلی' : r}
              </button>
            ))}
          </div>

          {/* محفظه ویدیو - بدون برش اجباری */}
          <div className="relative max-h-[75vh] max-w-full flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl border border-stone-800/80">
            <video
              ref={videoRef}
              src={videoUrl}
              onClick={onTogglePlay}
              className="max-h-[75vh] w-auto object-contain cursor-pointer"
              playsInline
            />

            {/* زیرنویس زنده روی تصویر */}
            {activeSegment && (
              <div
                className="absolute bottom-8 px-4 py-2 max-w-[90%] text-center select-none"
                style={{
                  backgroundColor: styleConfig.hasBg ? styleConfig.bgColor : 'transparent',
                  borderRadius: `${styleConfig.bgRadius}px`,
                  textAlign: styleConfig.alignment,
                  textShadow: styleConfig.hasShadow
                    ? `${styleConfig.shadowX}px ${styleConfig.shadowY}px ${styleConfig.shadowBlur}px ${styleConfig.shadowColor}`
                    : 'none',
                }}
              >
                <span
                  style={{
                    fontFamily: styleConfig.fontFamily,
                    fontSize: `${styleConfig.fontSize}px`,
                    fontWeight: styleConfig.fontWeight,
                    color: styleConfig.textColor,
                  }}
                >
                  {activeSegment.text}
                </span>
              </div>
            )}
          </div>

          {/* نوار کنترل پلیر */}
          <div className="w-full max-w-2xl mt-4 flex items-center gap-3 bg-[#110f0d] p-2.5 rounded-2xl border border-stone-800">
            <button
              type="button"
              onClick={onTogglePlay}
              className="h-9 w-9 rounded-xl bg-amber-500 text-black flex items-center justify-center font-bold text-xs"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={currentTime}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="flex-1 accent-amber-500 cursor-pointer"
            />
            <span className="font-mono text-xs text-stone-400">
              {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
            </span>
          </div>
        </div>

        {/* ستون چپ: پنل مدیریت زیرنویس‌ها و افکت‌ها */}
        <div className="w-[450px] flex flex-col bg-[#0e0d0b] overflow-hidden">
          {/* هدر ستون کپشن‌ها */}
          <div className="p-3 border-b border-stone-800 flex items-center justify-between bg-[#12100d]">
            <span className="text-xs font-bold text-white">
              کپشن‌ها ({segments.length})
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const newSeg: CaptionSegment = {
                    id: `seg_${Date.now()}`,
                    start: currentTime,
                    end: currentTime + 2.5,
                    text: 'متن جدید زیرنویس',
                  }
                  onUpdateSegments([...segments, newSeg])
                }}
                className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-bold hover:bg-amber-500/20"
              >
                + افزودن کپشن
              </button>
            </div>
          </div>

          {/* لیست سگمنت‌ها */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
            {segments.map((seg) => {
              const isCurrent = currentTime >= seg.start && currentTime <= seg.end
              return (
                <div
                  key={seg.id}
                  onClick={() => {
                    setSelectedSegId(seg.id)
                    onSeek(seg.start)
                  }}
                  className={`p-3 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'bg-amber-500/10 border-amber-500/60 shadow-lg'
                      : 'bg-stone-900/60 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1 font-mono text-[11px] text-stone-400">
                      <span className="bg-stone-800 px-2 py-0.5 rounded-md text-amber-400">
                        {seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s
                      </span>
                    </div>

                    {/* دکمه‌های کالیبراسیون زمانی 0.5s */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAdjustTime(seg.id, -0.5, 0)
                        }}
                        className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300"
                        title="عقب بردن شروع"
                      >
                        0.5-
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAdjustTime(seg.id, 0.5, 0)
                        }}
                        className="px-1.5 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300"
                        title="جلو بردن شروع"
                      >
                        0.5+
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSeg(seg.id)
                        }}
                        className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[10px] ml-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={seg.text}
                    onChange={(e) => handleTextChange(seg.id, e.target.value)}
                    className="w-full bg-black/40 border border-stone-800/80 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-amber-500/50 resize-none"
                  />
                </div>
              )
            })}
          </div>

          {/* پالت استایل سریع در پایین ستون چپ */}
          <div className="p-3 border-t border-stone-800 bg-[#12100d] flex items-center justify-between">
            <span className="text-xs font-bold text-stone-400">استایل فونت:</span>
            <div className="flex gap-2">
              {['Vazirmatn', 'Shabnam', 'Yekan'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onUpdateStyle({ fontFamily: f })}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition border ${
                    styleConfig.fontFamily === f
                      ? 'bg-amber-500 text-black border-amber-500'
                      : 'bg-stone-900 border-stone-800 text-stone-300'
                  }`}
                >
                  {f === 'Vazirmatn' ? 'وزیر' : f === 'Shabnam' ? 'شبنم' : 'یکان'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* مودال خروجی */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#14120f] border border-stone-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-stone-800 pb-3">
              <h3 className="text-base font-bold text-white">خروجی نهایی ویدیو</h3>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="text-stone-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <SubtitleVideoExport
              videoUrl={videoUrl}
              segments={segments as any}
              style={{
                fontId: styleConfig.fontFamily,
                color: styleConfig.textColor,
                karaoke: true,
              } as any}
            />
          </div>
        </div>
      )}
    </div>
  )
}
