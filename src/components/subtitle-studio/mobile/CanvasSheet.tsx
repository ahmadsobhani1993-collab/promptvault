'use client'

import { SubtitleStyleConfig } from './useMobileStudioState'

interface Props {
  isOpen: boolean
  onClose: () => void
  config: SubtitleStyleConfig
  onChange: (patch: Partial<SubtitleStyleConfig>) => void
}

const RATIOS: { id: SubtitleStyleConfig['aspectRatio']; label: string; sub: string }[] = [
  { id: 'original', label: 'Original', sub: 'ابعاد اصلی' },
  { id: '1:1', label: '1:1', sub: 'پست اینستاگرام' },
  { id: '4:5', label: '4:5', sub: 'پرتره اینستاگرام' },
  { id: '9:16', label: '9:16', sub: 'استوری و ریلز' },
  { id: '16:9', label: '16:9', sub: 'یوتیوب' },
]

export default function CanvasSheet({ isOpen, onClose, config, onChange }: Props) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full rounded-t-3xl border-t border-stone-800 bg-[#141210] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
          <h3 className="text-sm font-bold text-amber-400">کادر ویدیو (Canvas)</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-white text-xs">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-stone-400 block mb-3">Aspect Ratio</label>
            <div className="grid grid-cols-5 gap-2">
              {RATIOS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onChange({ aspectRatio: r.id })}
                  className={`py-3 px-1 rounded-2xl border text-center transition-all ${
                    config.aspectRatio === r.id
                      ? 'border-amber-400 bg-amber-500/10 text-amber-400'
                      : 'border-stone-800 bg-stone-900/60 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <p className="text-xs font-bold">{r.label}</p>
                  <p className="text-[9px] mt-1 line-clamp-1">{r.sub}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <label className="text-xs text-stone-400 block mb-2">Content Fit</label>
            <div className="grid grid-cols-2 gap-3">
              {(['fit', 'fill'] as const).map((fit) => (
                <button
                  key={fit}
                  onClick={() => onChange({ contentFit: fit })}
                  className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    config.contentFit === fit
                      ? 'border-amber-400 bg-amber-500 text-black'
                      : 'border-stone-800 bg-stone-900/60 text-stone-400'
                  }`}
                >
                  {fit === 'fit' ? 'تطبیق کامل (Fit)' : 'پر کردن صفحه (Fill)'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
