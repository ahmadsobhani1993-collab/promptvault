'use client'

import { useRef } from 'react'
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
    <div className="relative flex flex-col h-[90vh] max-w-md mx-auto bg-[#070605] rounded-3xl overflow-hidden border border-stone-800 shadow-2xl">
      {/* ۱. ناحیه نمایش ویدیو و متن شناور با نسبت انتخابی Canvas */}
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
            className={`w-full h-full ${styleConfig.contentFit === 'cover' ? 'object-cover' : 'object-contain'}`}
            playsInline
          />

          {/* کادر زیرنویس متحرک روی ویدیو با استایل‌های کاربر */}
          {currentSegment && (
            <div
              onClick={() => setActiveSheet('caption_edit')}
              className="absolute bottom-12 px-4 py-2 text-center cursor-pointer select-none transition-all border border-dashed border-amber-400/40 rounded-xl"
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

        {/* ۲. نوار ابزار عمودی سمت چپ شناور (مطابق ویدیو) */}
        <div className="absolute left-3 top-6 flex flex-col gap-3 z-20 bg-black/60 backdrop-blur-md p-2 rounded-2xl border border-stone-800/80">
          <button
            onClick={() => setActiveSheet('canvas')}
            className="flex flex-col items-center text-[10px] text-stone-300 hover:text-amber-400"
          >
            <span className="text-base">📐</span>
            <span>Canvas</span>
          </button>

          <button
            onClick={() => setActiveSheet('style')}
            className="flex flex-col items-center text-[10px] text-stone-300 hover:text-amber-400"
          >
            <span className="text-base">🎨</span>
            <span>Style</span>
          </button>

          <button
            onClick={() => setActiveSheet('caption_edit')}
            className="flex flex-col items-center text-[10px] text-stone-300 hover:text-amber-400"
          >
            <span className="text-base">✏️</span>
            <span>Caption</span>
          </button>

          <button
            onClick={() => alert('تنظیمات سایه در تب Style موجود است.')}
            className="flex flex-col items-center text-[10px] text-stone-300 hover:text-amber-400"
          >
            <span className="text-base">🌑</span>
            <span>Shadow</span>
          </button>
        </div>
      </div>

      {/* ۳. تایم‌لاین سگمنت‌ها در پایین */}
      <div className="bg-[#12100d] border-t border-stone-800 p-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-mono text-stone-400">
            {currentTime.toFixed(1)}s / {subtitles.length} سگمنت
          </span>
          <button
            onClick={onExport}
            className="bg-amber-500 text-black px-3 py-1 rounded-lg text-xs font-bold hover:bg-amber-400 transition-all"
          >
            خروجی نهایی
          </button>
        </div>

        {/* لیست قطعات زیرنویس با قابلیت اسکرول و کلیک سریع */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {subtitles.map((sub, idx) => (
            <button
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

      {/* مودال‌ها و شیت‌های پایین */}
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
