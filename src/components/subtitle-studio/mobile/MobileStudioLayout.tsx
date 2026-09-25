'use client'

import { useMobileStudioState } from './useMobileStudioState'
import SubtitleStyleModal from './StyleSheet/SubtitleStyleModal'
import CanvasSheet from './CanvasSheet'
import CaptionEditSheet from './CaptionEditSheet'

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
  onExport: () => void
}

export default function MobileStudioLayout({
  videoUrl,
  subtitles,
  onUpdateSubtitleText,
  currentTime,
  onSeek,
  onExport,
}: Props) {
  const {
    styleConfig,
    updateStyle,
    activeSheet,
    setActiveSheet,
    selectedSegmentIndex,
    setSelectedSegmentIndex,
  } = useMobileStudioState()

  const currentSegment = subtitles[selectedSegmentIndex] || subtitles[0]

  return (
    <div className="relative flex flex-col h-[85vh] max-w-md mx-auto bg-[#070605] rounded-3xl overflow-hidden border border-stone-800 shadow-2xl">
      {/* نوار هدر ثابت بالای استودیو همراه دکمه خروجی رسمی */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#110f0d] border-b border-stone-800/80 z-30">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-stone-200">استودیو زیرنویس</span>
        </div>
        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black px-4 py-1.5 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
        >
          <span>خروجی نهایی</span>
          <span>⬇️</span>
        </button>
      </div>

      {/* ناحیه ویدیو */}
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
              className="absolute bottom-8 px-4 py-2 text-center cursor-pointer select-none transition-all border border-dashed border-amber-400/50 rounded-xl bg-black/40 backdrop-blur-sm"
              style={{
                backgroundColor: styleConfig.hasBg ? styleConfig.bgColor : undefined,
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
        <div className="absolute left-3 top-4 flex flex-col gap-2.5 z-20 bg-black/70 backdrop-blur-md p-2 rounded-2xl border border-stone-800/80 shadow-xl">
          <button
            type="button"
            onClick={() => setActiveSheet('canvas')}
            className="flex flex-col items-center gap-1 text-[10px] text-stone-300 hover:text-amber-400 transition"
          >
            <span className="text-base">📐</span>
            <span>کادر</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet('style')}
            className="flex flex-col items-center gap-1 text-[10px] text-stone-300 hover:text-amber-400 transition"
          >
            <span className="text-base">🎨</span>
            <span>استایل</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet('caption_edit')}
            className="flex flex-col items-center gap-1 text-[10px] text-stone-300 hover:text-amber-400 transition"
          >
            <span className="text-base">✏️</span>
            <span>متن</span>
          </button>
        </div>
      </div>

      {/* تایم‌لاین سگمنت‌ها در پایین */}
      <div className="bg-[#12100d] border-t border-stone-800 p-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-mono text-stone-400">
            ⏱️ {currentTime.toFixed(1)} ثانیه / {subtitles.length} سگمنت
          </span>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {subtitles.map((sub, idx) => (
            <button
              type="button"
              key={sub.id || idx}
              onClick={() => {
                setSelectedSegmentIndex(idx)
                onSeek(sub.start)
              }}
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                selectedSegmentIndex === idx
                  ? 'bg-amber-500 text-black font-bold shadow-md'
                  : 'bg-stone-900 border border-stone-800 text-stone-300 hover:border-stone-700'
              }`}
            >
              {sub.text}
            </button>
          ))}
        </div>
      </div>

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
