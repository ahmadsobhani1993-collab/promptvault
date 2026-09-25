'use client'

import React, { useState } from 'react'
import { CaptionSegment, SocialPostPlan } from '@/lib/studio/types'
import { generateSocialPost } from '@/lib/studio/translate-service'

interface Props {
  segments: CaptionSegment[]
  onClose: () => void
}

export default function PreparePostPanel({ segments, onClose }: Props) {
  const [plan, setPlan] = useState<SocialPostPlan>(() => generateSocialPost(segments))
  const [copied, setCopied] = useState(false)

  const copyFullPost = () => {
    const text = `${plan.hook}\n\n${plan.caption}\n\n${plan.hashtags.join(' ')}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-4 flex flex-col gap-4 text-right" dir="rtl">
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <h3 className="text-sm font-black text-white">آماده‌سازی برای انتشار (Prepare Post)</h3>
        <button onClick={onClose} className="text-stone-400 hover:text-white text-xs">✕ بستن</button>
      </div>

      <div>
        <label className="text-xs font-bold text-stone-300 block mb-1">قلاب جلب توجه (Hook)</label>
        <input
          type="text"
          value={plan.hook}
          onChange={(e) => setPlan({ ...plan, hook: e.target.value })}
          className="w-full rounded-xl border border-stone-800 bg-stone-900 p-2.5 text-xs text-white"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-stone-300 block mb-1">متن کپشن پیشنهادی (Caption)</label>
        <textarea
          rows={4}
          value={plan.caption}
          onChange={(e) => setPlan({ ...plan, caption: e.target.value })}
          className="w-full rounded-xl border border-stone-800 bg-stone-900 p-2.5 text-xs text-white"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-stone-300 block mb-1">هشتگ‌ها</label>
        <input
          type="text"
          value={plan.hashtags.join(' ')}
          onChange={(e) => setPlan({ ...plan, hashtags: e.target.value.split(' ') })}
          className="w-full rounded-xl border border-stone-800 bg-stone-900 p-2.5 text-xs text-white font-mono"
        />
      </div>

      <button
        type="button"
        onClick={copyFullPost}
        className="w-full rounded-xl bg-amber-500 py-3 text-xs font-black text-black hover:bg-amber-400 transition"
      >
        {copied ? '✅ کپی شد!' : '📋 کپی متن کامل پست در کلیپ‌بورد'}
      </button>
    </div>
  )
}
