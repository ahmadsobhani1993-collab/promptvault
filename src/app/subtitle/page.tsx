'use client'

import { useState } from 'react'
import ComprehensiveStudio from '@/components/studio/ComprehensiveStudio'
import ToolAuthGuard from '@/components/tools/ToolAuthGuard'

export default function SubtitlePage() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setVideoUrl(URL.createObjectURL(file))
    }
  }

  return (
    <ToolAuthGuard toolName="استودیو ساخت زیرنویس و ویدیو">
      {!videoUrl ? (
        <main className="container-app min-h-[80vh] flex flex-col items-center justify-center p-6 text-center" dir="rtl">
          <div className="max-w-md w-full rounded-3xl border border-stone-800 bg-[#110f0d] p-8 shadow-2xl">
            <div className="h-16 w-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl">
              🎬
            </div>
            <h1 className="text-xl font-black text-white mb-2">ورود به استودیو زیرنویس</h1>
            <p className="text-xs text-stone-400 leading-relaxed mb-6">
              یک ویدیوی عمودی یا افقی انتخاب کنید تا استودیوی پیشرفته زیرنویس با قابلیت هوش مصنوعی برای شما باز شود.
            </p>
            <label className="block w-full cursor-pointer rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-xs font-black text-black hover:from-orange-400 hover:to-amber-400 shadow-lg shadow-orange-500/20 active:scale-95 transition">
              انتخاب ویدیو از دستگاه
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>
        </main>
      ) : (
        <ComprehensiveStudio
          videoUrl={videoUrl}
          onClose={() => setVideoUrl(null)}
          initialSubtitles={[
            { id: '1', start: 0, end: 3, text: 'به استودیوی حرفه‌ای خوش آمدید' },
            { id: '2', start: 3, end: 6, text: 'آنچه مقدر است خواهد آمد، آرام باشید' },
          ]}
        />
      )}
    </ToolAuthGuard>
  )
}
