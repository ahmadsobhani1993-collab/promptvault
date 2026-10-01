'use client'
import { useState } from 'react'

interface Props {
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, language: string) => void
}

export default function UploadScreen({ onFileSelect }: Props) {
  const [speed, setSpeed] = useState<1 | 2 | 4 | 8>(4)
  const [language, setLanguage] = useState('fa')

  return (
    <div className="min-h-screen bg-[#070605] text-white flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md rounded-3xl border border-stone-800 bg-[#12100d] p-8 text-center">
        <div className="text-7xl mb-4">🎬</div>
        <h2 className="text-lg font-black mb-2">ویدیوی خود را وارد کنید</h2>
        <p className="text-xs text-stone-400 mb-6">حداکثر ۲۵۰ مگابایت</p>
        
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-xs text-stone-400">سرعت:</span>
          {([1, 2, 4, 8] as const).map(s => (
            <button 
              key={s} 
              onClick={() => setSpeed(s)} 
              className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                speed === s ? 'bg-amber-500 text-black' : 'bg-stone-900 text-stone-400'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <label className="mb-5 block text-right text-xs text-stone-400">
          زبان گفتار ویدیو
          <select value={language} onChange={event => setLanguage(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-white outline-none focus:border-amber-500">
            <option value="fa">فارسی</option>
            <option value="en">English</option>
            <option value="auto">تشخیص خودکار</option>
          </select>
          <span className="mt-1 block text-[10px] text-stone-500">برای ویدیوی فارسی، انتخاب فارسی معمولاً از تشخیص خودکار دقیق‌تر است.</span>
        </label>

        <label className="block cursor-pointer rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 py-3 text-xs font-black text-black transition-all hover:from-amber-500 hover:to-amber-400">
          انتخاب ویدیو
          <input type="file" accept="video/*,.mov,.mp4" onChange={event => onFileSelect(event, language)} className="hidden" />
        </label>
      </div>
    </div>
  )
}


