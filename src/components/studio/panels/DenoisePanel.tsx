'use client'

import React from 'react'
import { DenoiseSettings } from '@/lib/studio/types'

interface Props {
  settings: DenoiseSettings
  onChange: (patch: Partial<DenoiseSettings>) => void
  onClose: () => void
}

export default function DenoisePanel({ settings, onChange, onClose }: Props) {
  return (
    <div className="p-4 flex flex-col gap-5 text-right" dir="rtl">
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <h3 className="text-sm font-black text-white">حذف هوشمند نویز صدا (AI Denoise)</h3>
        <button onClick={onClose} className="text-stone-400 hover:text-white text-xs">✕ بستن</button>
      </div>

      {/* سوئیچ روشن/خاموش حذف نویز */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-stone-900/80 border border-stone-800">
        <div>
          <span className="text-xs font-bold text-white block">فعال‌سازی فیلتر نویز (Remove Noise)</span>
          <span className="text-[10px] text-stone-400">حذف فرکانس‌های هیس و باد محیطی به صورت بلادرنگ</span>
        </div>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          className="h-5 w-5 accent-amber-500 cursor-pointer"
        />
      </div>

      {/* اسلایدر شدت نویزگیری */}
      <div>
        <div className="flex justify-between text-xs font-bold text-stone-300 mb-2">
          <span>شدت نویزگیری (Noise Reduction)</span>
          <span className="font-mono text-amber-400">{settings.intensity}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.intensity}
          onChange={(e) => onChange({ intensity: Number(e.target.value) })}
          disabled={!settings.enabled}
          className="w-full accent-amber-500 cursor-pointer disabled:opacity-30"
        />
      </div>

      {/* کنترل شدت صدا (Volume) */}
      <div>
        <div className="flex justify-between text-xs font-bold text-stone-300 mb-2">
          <span>تقویت صدای خروجی (Volume Boost)</span>
          <span className="font-mono text-amber-400">{settings.volume}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="200"
          value={settings.volume}
          onChange={(e) => onChange({ volume: Number(e.target.value) })}
          className="w-full accent-amber-500 cursor-pointer"
        />
      </div>
    </div>
  )
}
