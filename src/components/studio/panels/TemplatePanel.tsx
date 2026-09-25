'use client'

import React, { useState } from 'react'
import { TEMPLATES } from '@/lib/studio/templates/data'
import { StyleConfig, TemplateCategory } from '@/lib/studio/types'

interface Props {
  config: StyleConfig
  onChange: (patch: Partial<StyleConfig>) => void
  onClose: () => void
}

const CATEGORIES: TemplateCategory[] = [
  'All',
  'Popular',
  'Dynamic',
  'Music',
  'Progress',
  'Standard',
  'Fantasy',
  'Cinema',
  'Text Effect',
]

export default function TemplatePanel({ config, onChange, onClose }: Props) {
  const [selectedCat, setSelectedCat] = useState<TemplateCategory>('All')

  const filtered = selectedCat === 'All'
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.category === selectedCat)

  return (
    <div className="p-4 flex flex-col gap-4 text-right" dir="rtl">
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <h3 className="text-sm font-black text-white">قالب‌های آماده (Templates)</h3>
        <button onClick={onClose} className="text-stone-400 hover:text-white text-xs">✕ بستن</button>
      </div>

      {/* دسته‌بندی‌ها */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCat(cat)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              selectedCat === cat
                ? 'bg-amber-500 text-black shadow-md'
                : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-white'
            }`}
          >
            {cat} {cat === 'Dynamic' && <span className="text-[9px] bg-red-500 text-white px-1 rounded ml-1">NEW</span>}
          </button>
        ))}
      </div>

      {/* شبکه کارت‌های تمپلیت */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[42vh] overflow-y-auto p-1">
        {filtered.map((item) => {
          const isSelected = config.templateId === item.id
          return (
            <div
              key={item.id}
              onClick={() => {
                onChange({ ...item.style, templateId: item.id })
              }}
              style={{ background: item.previewBg }}
              className={`relative flex flex-col justify-end p-3 h-28 rounded-2xl cursor-pointer border transition-all ${
                isSelected
                  ? 'border-amber-400 ring-2 ring-amber-400/50 scale-[1.02]'
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <div className="text-xs font-black text-white drop-shadow-md">
                {item.name}
              </div>
              <span className="text-[9px] text-white/60 font-mono">
                {item.category}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
