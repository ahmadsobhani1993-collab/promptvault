'use client'

import { useState } from 'react'
import { SubtitleStyleConfig } from '../useMobileStudioState'

interface Props {
  isOpen: boolean
  onClose: () => void
  config: SubtitleStyleConfig
  onChange: (patch: Partial<SubtitleStyleConfig>) => void
}

const TEMPLATES = [
  { id: 'popular-yellow', name: 'انجمن ادبیات داستانی', category: 'Popular', textCol: '#ffffff', actCol: '#facc15' },
  { id: 'popular-cyan', name: 'انجمن ادبیات', category: 'Popular', textCol: '#ffffff', actCol: '#38bdf8' },
  { id: 'dynamic-glow', name: 'روایت برگزار می‌کند', category: 'Dynamic', textCol: '#ffffff', actCol: '#f43f5e' },
  { id: 'music-green', name: 'جلسه نقد داستان', category: 'Music', textCol: '#a7f3d0', actCol: '#10b981' },
  { id: 'cinema-red', name: 'نشست تخصصی', category: 'Cinema', textCol: '#ffffff', actCol: '#ef4444' },
]

const PERSIAN_FONTS = [
  { id: 'dana', label: 'دانا' },
  { id: 'kalameh', label: 'کلمه' },
  { id: 'douran', label: 'دوران' },
  { id: 'peyda', label: 'پیدا' },
  { id: 'farhang', label: 'فرهنگ' },
  { id: 'sarbaaz', label: 'سرباز' },
  { id: 'iransans', label: 'ایران‌سنس' },
  { id: 'yekan', label: 'یکان‌بخش' },
]

export default function SubtitleStyleModal({ isOpen, onClose, config, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<'template' | 'font' | 'color' | 'shadow'>('template')
  const [templateCat, setTemplateCat] = useState('All')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/90 backdrop-blur-none animate-fade-in">
      <div 
        className="w-full rounded-t-3xl border-t border-stone-800 bg-[#141210] p-5 shadow-2xl max-h-[75vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* هدر بالایی شیت و دکمه بستن */}
        <div className="flex items-center justify-between border-b border-stone-800/80 pb-3 mb-4">
          <div className="flex gap-2">
            {[
              { id: 'template', label: 'Template' },
              { id: 'font', label: 'Font' },
              { id: 'color', label: 'Color' },
              { id: 'shadow', label: 'Shadow' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                    : 'text-stone-400 hover:text-white bg-stone-900/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-stone-400 hover:text-white text-xs">
            ✕
          </button>
        </div>

        {/* محتوای تب Template */}
        {activeTab === 'template' && (
          <div className="overflow-y-auto space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-2 text-xs no-scrollbar">
              {['All', 'Popular', 'Dynamic', 'Music', 'Cinema'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setTemplateCat(cat)}
                  className={`px-3 py-1 rounded-lg shrink-0 ${
                    templateCat === cat ? 'bg-stone-700 text-white font-bold' : 'text-stone-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {TEMPLATES.filter((t) => templateCat === 'All' || t.category === templateCat).map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => {
                    onChange({
                      template: tpl.id,
                      textColor: tpl.textCol,
                      activeWordColor: tpl.actCol,
                    })
                  }}
                  className={`cursor-pointer rounded-2xl border p-4 text-center transition-all bg-black/40 flex flex-col items-center justify-center min-h-[90px] ${
                    config.template === tpl.id
                      ? 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                      : 'border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <p className="text-sm font-bold leading-tight" style={{ color: tpl.textCol }}>
                    {tpl.name}
                  </p>
                  <span className="mt-1 text-[10px] px-2 py-0.5 rounded-md" style={{ color: tpl.actCol, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                    کلمه فعال
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* محتوای تب Font (فارسی) */}
        {activeTab === 'font' && (
          <div className="overflow-y-auto space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {PERSIAN_FONTS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onChange({ fontFamily: f.id })}
                  className={`py-3 px-2 rounded-xl border text-xs font-bold transition-all ${
                    config.fontFamily === f.id
                      ? 'border-amber-400 bg-amber-500/10 text-amber-400'
                      : 'border-stone-800 bg-stone-900/60 text-stone-300 hover:border-stone-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            
            <div className="mt-4 border-t border-stone-800 pt-3">
              <label className="text-xs text-stone-400 block mb-2">اندازه فونت: {config.fontSize}px</label>
              <input
                type="range"
                min="14"
                max="40"
                value={config.fontSize}
                onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </div>
          </div>
        )}

        {/* محتوای تب Color */}
        {activeTab === 'color' && (
          <div className="overflow-y-auto space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <span className="text-stone-300">رنگ کلمه فعال (Active Word)</span>
              <input
                type="color"
                value={config.activeWordColor}
                onChange={(e) => onChange({ activeWordColor: e.target.value })}
                className="h-8 w-12 rounded border border-stone-700 bg-transparent cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <span className="text-stone-300">رنگ کل متن (Text Color)</span>
              <input
                type="color"
                value={config.textColor}
                onChange={(e) => onChange({ textColor: e.target.value })}
                className="h-8 w-12 rounded border border-stone-700 bg-transparent cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-stone-300">پس‌زمینه متن (Background Box)</span>
                <input
                  type="checkbox"
                  checked={config.hasBg}
                  onChange={(e) => onChange({ hasBg: e.target.checked })}
                  className="accent-amber-500 h-4 w-4"
                />
              </div>

              {config.hasBg && (
                <div className="pl-2 pt-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">گردی گوشه‌ها (Radius): {config.bgRadius}px</span>
                    <input
                      type="range"
                      min="0"
                      max="24"
                      value={config.bgRadius}
                      onChange={(e) => onChange({ bgRadius: Number(e.target.value) })}
                      className="w-32 accent-amber-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* محتوای تب Shadow */}
        {activeTab === 'shadow' && (
          <div className="overflow-y-auto space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <span className="text-stone-300">سایه متن (Drop Shadow)</span>
              <input
                type="checkbox"
                checked={config.hasShadow}
                onChange={(e) => onChange({ hasShadow: e.target.checked })}
                className="accent-amber-500 h-4 w-4"
              />
            </div>

            {config.hasShadow && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-stone-400">تاری سایه (Blur): {config.shadowBlur}px</span>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={config.shadowBlur}
                    onChange={(e) => onChange({ shadowBlur: Number(e.target.value) })}
                    className="w-36 accent-amber-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-400">موقعیت افقی (X)</span>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    value={config.shadowX}
                    onChange={(e) => onChange({ shadowX: Number(e.target.value) })}
                    className="w-36 accent-amber-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-400">موقعیت عمودی (Y)</span>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    value={config.shadowY}
                    onChange={(e) => onChange({ shadowY: Number(e.target.value) })}
                    className="w-36 accent-amber-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

