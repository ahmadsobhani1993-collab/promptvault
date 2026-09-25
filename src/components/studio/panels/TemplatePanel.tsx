'use client'

import React, { useState } from 'react'
import { StudioStyleConfig, TEMPLATES, AspectRatio, ContentFit } from '@/lib/studio/unified-style'

interface Props {
  config: StudioStyleConfig
  onChange: (patch: Partial<StudioStyleConfig>) => void
  onClose: () => void
}

export default function TemplatePanel({ config, onChange, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'templates' | 'canvas' | 'typography' | 'box_shadow'>('templates')

  const fontOptions = [
    { label: 'وزیرمتن', value: 'Vazirmatn' },
    { label: 'شبنم', value: 'Shabnam' },
    { label: 'صمیم', value: 'Samim' },
    { label: 'ساحل', value: 'Sahel' },
  ]

  const aspectRatios: { label: string; value: AspectRatio }[] = [
    { label: 'اصلی', value: 'original' },
    { label: 'عمودی (9:16)', value: '9:16' },
    { label: 'افقی (16:9)', value: '16:9' },
    { label: 'مربعی (1:1)', value: '1:1' },
    { label: 'پست (4:5)', value: '4:5' },
  ]

  return (
    <div className="p-4 flex flex-col gap-4 text-right select-none" dir="rtl">
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <h3 className="text-sm font-black text-white">تنظیمات استودیو و استایل</h3>
        <button type="button" onClick={onClose} className="text-stone-400 hover:text-white text-xs">✕ بستن</button>
      </div>

      <div className="flex bg-stone-900 border border-stone-800 rounded-xl p-1 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'templates' ? 'bg-amber-500 text-black' : 'text-stone-400'}`}
        >
          قالب‌ها
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('canvas')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'canvas' ? 'bg-amber-500 text-black' : 'text-stone-400'}`}
        >
          کادر
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('typography')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'typography' ? 'bg-amber-500 text-black' : 'text-stone-400'}`}
        >
          قلم و رنگ
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('box_shadow')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'box_shadow' ? 'bg-amber-500 text-black' : 'text-stone-400'}`}
        >
          باکس و سایه
        </button>
      </div>

      {activeTab === 'templates' && (
        <div className="grid grid-cols-2 gap-2.5 max-h-[52vh] overflow-y-auto p-1">
          {TEMPLATES.map((tpl) => {
            const isSelected = config.templateId === tpl.id
            return (
              <div
                key={tpl.id}
                onClick={() => onChange({ ...tpl.style, templateId: tpl.id })}
                style={{ background: tpl.previewBg }}
                className={`flex flex-col justify-end p-3 h-24 rounded-2xl cursor-pointer border transition-all ${
                  isSelected ? 'border-amber-400 ring-2 ring-amber-400/50 scale-[1.02]' : 'border-white/10 hover:border-white/30'
                }`}
              >
                <span className="text-xs font-black text-white drop-shadow-md">{tpl.name}</span>
                <span className="text-[9px] text-white/70 font-mono">{tpl.category}</span>
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'canvas' && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-stone-300 block mb-2">نسبت ابعاد بوم (Aspect Ratio):</label>
            <div className="grid grid-cols-2 gap-2">
              {aspectRatios.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => onChange({ aspectRatio: r.value })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    config.aspectRatio === r.value ? 'bg-amber-500 text-black border-amber-500' : 'bg-stone-900 border-stone-800 text-stone-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-stone-800 pt-3">
            <label className="text-xs font-bold text-stone-300 block mb-2">نحوه قرارگیری در کادر (Fit / Cover):</label>
            <div className="flex gap-2">
              {(['contain', 'cover'] as ContentFit[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChange({ contentFit: mode })}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                    config.contentFit === mode ? 'bg-amber-500 text-black border-amber-500' : 'bg-stone-900 border-stone-800 text-stone-400'
                  }`}
                >
                  {mode === 'contain' ? 'نمایش کامل (Fit)' : 'پر کردن کامل (Cover)'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'typography' && (
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="text-xs font-bold text-stone-300 block mb-1.5">انتخاب قلم:</label>
            <div className="grid grid-cols-2 gap-2">
              {fontOptions.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => onChange({ fontFamily: f.value })}
                  className={`py-2 px-2 text-center rounded-xl text-xs font-bold border transition ${
                    config.fontFamily === f.value ? 'bg-amber-500 text-black border-amber-500' : 'bg-stone-900 border-stone-800 text-stone-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-300">اندازه قلم (درصد کادر ویدیو):</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={2.5}
                max={8.5}
                step={0.1}
                value={config.fontSizePercent}
                onChange={(e) => onChange({ fontSizePercent: Number(e.target.value) })}
                className="w-28 accent-amber-500 cursor-pointer"
              />
              <span className="font-mono text-xs text-amber-400 w-8">{config.fontSizePercent}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-300">حالت کج (Italic):</span>
            <input
              type="checkbox"
              checked={config.italic}
              onChange={(e) => onChange({ italic: e.target.checked })}
              className="h-5 w-5 accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-300">رنگ اصلی متن:</span>
            <input
              type="color"
              value={config.textColor}
              onChange={(e) => onChange({ textColor: e.target.value })}
              className="h-8 w-12 rounded-lg bg-transparent cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-300">رنگ کلمه فعال:</span>
            <input
              type="color"
              value={config.activeWordColor}
              onChange={(e) => onChange({ activeWordColor: e.target.value })}
              className="h-8 w-12 rounded-lg bg-transparent cursor-pointer"
            />
          </div>
        </div>
      )}

      {activeTab === 'box_shadow' && (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-300">باکس پس‌زمینه متن:</span>
            <input
              type="checkbox"
              checked={config.hasBg}
              onChange={(e) => onChange({ hasBg: e.target.checked })}
              className="h-5 w-5 accent-amber-500 cursor-pointer"
            />
          </div>

          {config.hasBg && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-400">رنگ باکس:</span>
                <input
                  type="color"
                  value={config.bgColor.startsWith('#') ? config.bgColor : '#000000'}
                  onChange={(e) => onChange({ bgColor: e.target.value })}
                  className="h-8 w-12 rounded-lg bg-transparent cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-400">گردی گوشه‌ها (Radius):</span>
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={config.bgRadius}
                  onChange={(e) => onChange({ bgRadius: Number(e.target.value) })}
                  className="w-28 accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-400">پدینگ افقی (X):</span>
                <input
                  type="range"
                  min={8}
                  max={40}
                  value={config.bgPaddingX}
                  onChange={(e) => onChange({ bgPaddingX: Number(e.target.value) })}
                  className="w-28 accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-400">پدینگ عمودی (Y):</span>
                <input
                  type="range"
                  min={4}
                  max={30}
                  value={config.bgPaddingY}
                  onChange={(e) => onChange({ bgPaddingY: Number(e.target.value) })}
                  className="w-28 accent-amber-500 cursor-pointer"
                />
              </div>
            </>
          )}

          <div className="border-t border-stone-800 pt-3 flex items-center justify-between">
            <span className="text-xs font-bold text-stone-300">سایه متن (Shadow):</span>
            <input
              type="checkbox"
              checked={config.hasShadow}
              onChange={(e) => onChange({ hasShadow: e.target.checked })}
              className="h-5 w-5 accent-amber-500 cursor-pointer"
            />
          </div>

          {config.hasShadow && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-400">رنگ سایه:</span>
                <input
                  type="color"
                  value={config.shadowColor.startsWith('#') ? config.shadowColor : '#000000'}
                  onChange={(e) => onChange({ shadowColor: e.target.value })}
                  className="h-8 w-12 rounded-lg bg-transparent cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-400">میزان Blur:</span>
                <input
                  type="range"
                  min={0}
                  max={25}
                  value={config.shadowBlur}
                  onChange={(e) => onChange({ shadowBlur: Number(e.target.value) })}
                  className="w-28 accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-400">انحراف عمودی (Y):</span>
                <input
                  type="range"
                  min={-10}
                  max={15}
                  value={config.shadowY}
                  onChange={(e) => onChange({ shadowY: Number(e.target.value) })}
                  className="w-28 accent-amber-500 cursor-pointer"
                />
              </div>
            </>
          )}

          <div className="border-t border-stone-800 pt-3 flex items-center justify-between">
            <span className="text-xs font-bold text-stone-300">ارتفاع قرارگیری در بوم (Y%):</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={10}
                max={95}
                value={config.positionYPercent}
                onChange={(e) => onChange({ positionYPercent: Number(e.target.value) })}
                className="w-28 accent-amber-500 cursor-pointer"
              />
              <span className="font-mono text-xs text-amber-400 w-8">{config.positionYPercent}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
