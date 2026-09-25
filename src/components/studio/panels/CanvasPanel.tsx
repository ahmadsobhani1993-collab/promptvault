'use client'

import React from 'react'
import { AspectRatio, ContentFit, StyleConfig } from '@/lib/studio/types'

interface Props {
  config: StyleConfig
  onChange: (patch: Partial<StyleConfig>) => void
  onClose: () => void
}

export default function CanvasPanel({ config, onChange, onClose }: Props) {
  const ratios: { label: string; value: AspectRatio }[] = [
    { label: 'عمودی (9:16)', value: '9:16' },
    { label: 'مربعی (1:1)', value: '1:1' },
    { label: 'افقی (16:9)', value: '16:9' },
    { label: 'پست (4:5)', value: '4:5' },
  ]

  return (
    <div className="p-4 flex flex-col gap-5 text-right" dir="rtl">
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <h3 className="text-sm font-black text-white">تنظیمات بوم ویدیو (Canvas)</h3>
        <button onClick={onClose} className="text-stone-400 hover:text-white text-xs">✕ بستن</button>
      </div>

      <div>
        <label className="text-xs font-bold text-stone-300 block mb-2">نسبت تصویر (Aspect Ratio)</label>
        <div className="grid grid-cols-2 gap-2">
          {ratios.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => onChange({ aspectRatio: r.value })}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
                config.aspectRatio === r.value
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-stone-300 block mb-2">نحوه جای‌گیری (Fit)</label>
        <div className="flex gap-2">
          {(['fit', 'fill'] as ContentFit[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ contentFit: mode })}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition border ${
                config.contentFit === mode
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
              }`}
            >
              {mode === 'fill' ? 'پر کردن کامل (Crop/Fill)' : 'نمایش کامل (Fit)'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
