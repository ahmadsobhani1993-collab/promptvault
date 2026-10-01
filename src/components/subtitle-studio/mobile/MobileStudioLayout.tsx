'use client'

import { useEffect, useState } from 'react'
import { useMobileStudioState } from './useMobileStudioState'
import SubtitleStyleModal from './StyleSheet/SubtitleStyleModal'
import CanvasSheet from './CanvasSheet'
import CaptionEditSheet from './CaptionEditSheet'
import { useVideoExport } from '@/components/transcribe/export/useVideoExport'

interface SubtitleSegment {
  id: string
  start: number
  end: number
  text: string
}

interface Props {
  videoUrl: string
  subtitles: SubtitleSegment[]
  onUpdateSubtitleText: (index: number, newText: string) => void
  currentTime: number
  onSeek: (time: number) => void
  sourceFile?: File | null
}

export default function MobileStudioLayout({
  videoUrl,
  subtitles,
  onUpdateSubtitleText,
  currentTime,
  onSeek,
  sourceFile,
}: Props) {
  const {
    styleConfig,
    updateStyle,
    activeSheet,
    setActiveSheet,
    selectedSegmentIndex,
    setSelectedSegmentIndex,
  } = useMobileStudioState()

  const [showExportModal, setShowExportModal] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  const currentSegment = subtitles[selectedSegmentIndex] || subtitles[0]

  const {
    exporting,
    progress,
    stageText,
    exportVideo,
    cancelExport,
  } = useVideoExport(sourceFile)

  const handleEditClick = (index: number) => {
    setEditingIndex(index)
    setEditText(subtitles[index].text)
  }

  const handleEditSave = () => {
    if (editingIndex !== null && editText.trim()) {
      onUpdateSubtitleText(editingIndex, editText.trim())
    }
    setEditingIndex(null)
    setEditText('')
  }

  const handleEditCancel = () => {
    setEditingIndex(null)
    setEditText('')
  }

  return (
    <div className="relative flex flex-col h-[88vh] max-w-md mx-auto bg-[#070605] rounded-3xl overflow-hidden border border-stone-800 shadow-2xl">
      {/* هدر */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#110f0d] border-b border-stone-800 z-20">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-stone-200">استودیو زیرنویس</span>
        </div>
        <button
          type="button"
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black px-4 py-1.5 rounded-xl text-xs font-black shadow-md active:scale-95 transition-all"
        >
          <span>خروجی نهایی</span>
          <span>️</span>
        </button>
      </div>

      {/* ناحیه تصویر ویدیو */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        <div
          className={`relative transition-all overflow-hidden flex items-center justify-center ${
            styleConfig.aspectRatio === '9:16'
              ? 'aspect-[9/16] h-full'
              : styleConfig.aspectRatio === '1:1'
              ? 'aspect-square w-full'
              : styleConfig.aspectRatio === '4:5'
              ? 'aspect-[4/5] h-full'
              : 'w-full h-full'
          }`}
        >
          <video
            src={videoUrl}
            className={`w-full h-full ${styleConfig.contentFit === 'fill' ? 'object-cover' : 'object-contain'}`}
            playsInline
          />

          {currentSegment && (
            <div
              onClick={() => setActiveSheet('caption_edit')}
              className="absolute bottom-10 px-4 py-2 text-center cursor-pointer select-none transition-all border border-dashed border-amber-400/50"
              style={{
                backgroundColor: styleConfig.hasBg ? styleConfig.bgColor : 'transparent',
                borderRadius: `${styleConfig.bgRadius}px`,
                textShadow: styleConfig.hasShadow
                  ? `${styleConfig.shadowX}px ${styleConfig.shadowY}px ${styleConfig.shadowBlur}px ${styleConfig.shadowColor}`
                  : 'none',
              }}
            >
              <span
                style={{
                  color: styleConfig.activeWordColor,
                  fontSize: `${styleConfig.fontSize}px`,
                  fontWeight: 'bold',
                }}
              >
                {currentSegment.text}
              </span>
            </div>
          )}
        </div>

        {/* جعبه ابزارهای کناری */}
        <div className="absolute left-3 top-4 flex flex-col gap-2.5 z-10 bg-black/80 p-2 rounded-2xl border border-stone-800">
          <button
            type="button"
            onClick={() => setActiveSheet('canvas')}
            className="flex flex-col items-center gap-1 text-[10px] text-stone-300 hover:text-amber-400"
          >
            <span className="text-base">📐</span>
            <span>کادر</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet('style')}
            className="flex flex-col items-center gap-1 text-[10px] text-stone-300 hover:text-amber-400"
          >
            <span className="text-base">🎨</span>
            <span>استایل</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet('caption_edit')}
            className="flex flex-col items-center gap-1 text-[10px] text-stone-300 hover:text-amber-400"
          >
            <span className="text-base">✏️</span>
            <span>متن</span>
          </button>
        </div>
      </div>

      {/* ✅ سگمنت‌ها در پایین - با قابلیت ادیت مستقیم */}
      <div className="bg-[#12100d] border-t border-stone-800 p-3 z-10">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-mono text-stone-400">
            ⏱️ {currentTime.toFixed(1)} ثانیه / {subtitles.length} سگمنت
          </span>
          {editingIndex !== null && (
            <div className="flex gap-1">
              <button
                onClick={handleEditSave}
                className="px-2 py-1 rounded bg-amber-500 text-black text-[10px] font-bold"
              >
                ✓ ذخیره
              </button>
              <button
                onClick={handleEditCancel}
                className="px-2 py-1 rounded bg-stone-700 text-stone-300 text-[10px]"
              >
                ✕ انصراف
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {subtitles.map((sub, idx) => (
            <div
              key={sub.id || idx}
              className={`shrink-0 rounded-xl text-xs font-medium transition-all ${
                selectedSegmentIndex === idx
                  ? 'bg-amber-500 text-black font-bold shadow-md'
                  : 'bg-stone-900 border border-stone-800 text-stone-300'
              }`}
            >
              {editingIndex === idx ? (
                <textarea
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={handleEditSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleEditSave()
                    }
                    if (e.key === 'Escape') {
                      handleEditCancel()
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-32 h-16 bg-black/80 text-[10px] text-white resize-none outline-none border border-amber-500/50 rounded p-1"
                  rows={3}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSegmentIndex(idx)
                    onSeek(sub.start)
                  }}
                  onDoubleClick={() => handleEditClick(idx)}
                  className="px-3 py-2 text-left"
                >
                  {sub.text}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* مودال خروجی */}
      {showExportModal && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col justify-end p-4">
          <div className="bg-[#161412] border border-stone-800 rounded-3xl p-5 mb-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">دریافت خروجی نهایی ویدیو</h3>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="text-stone-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {exporting ? (
              <div className="space-y-4 text-center py-4">
                <div className="text-xs text-amber-400 font-mono">{stageText || 'در حال پردازش...'}</div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-800">
                  <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <button
                  onClick={cancelExport}
                  className="w-full rounded-lg border border-red-500/30 bg-red-500/10 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20"
                >
                  لغو عملیات
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-stone-400 text-center">
                  ویدیو با نسبت تصویر <span className="text-amber-400 font-bold">{styleConfig.aspectRatio || '16:9'}</span> و کیفیت بالا رندر خواهد شد.
                </p>
                <button
                  onClick={() => {
                    exportVideo(
                      videoUrl,
                      subtitles as any,
                      {
                        fontId: styleConfig.fontFamily,
                        fontFamily: styleConfig.fontFamily,
                        size: styleConfig.fontSize,
                        color: styleConfig.textColor,
                        hlColor: styleConfig.activeWordColor,
                        bgColor: styleConfig.bgColor,
                        bgOpacity: styleConfig.hasBg ? 0.6 : 0,
                        karaoke: true,
                        textShadowBlur: styleConfig.shadowBlur,
                        textShadowColor: styleConfig.shadowColor,
                        bgRadius: styleConfig.bgRadius,
                        x: 50,
                        y: 90,
                        aspectRatio: styleConfig.aspectRatio,
                      } as any,
                      'video'
                    )
                  }}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 py-3 text-xs font-black text-black transition-all hover:from-amber-500 hover:to-amber-400"
                >
                  شروع رندر و دانلود MP4 ⚡
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <SubtitleStyleModal
        isOpen={activeSheet === 'style'}
        onClose={() => setActiveSheet('none')}
        config={styleConfig}
        onChange={updateStyle}
      />

      <CanvasSheet
        isOpen={activeSheet === 'canvas'}
        onClose={() => setActiveSheet('none')}
        config={styleConfig}
        onChange={updateStyle}
      />

      <CaptionEditSheet
        isOpen={activeSheet === 'caption_edit'}
        onClose={() => setActiveSheet('none')}
        currentText={currentSegment ? currentSegment.text : ''}
        onApply={(newText) => {
          onUpdateSubtitleText(selectedSegmentIndex, newText)
        }}
      />
    </div>
  )
}