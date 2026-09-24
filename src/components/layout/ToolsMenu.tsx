'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type Props = {
  locale?: 'fa' | 'en'
}

export default function ToolsMenu({ locale = 'fa' }: Props) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(false), 500)
  }

  useEffect(() => () => cancelClose(), [])

  const isEn = locale === 'en'

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        cancelClose()
        setOpen(true)
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition hover:border-amber-500/40 hover:text-amber-300"
      >
        {isEn ? 'Tools' : 'ابزارها'}
        <span className={`text-[10px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div
          className={`absolute top-full z-50 mt-2 max-h-[85vh] w-72 overflow-y-auto rounded-xl border border-white/10 bg-zinc-900/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur ${
            isEn ? 'left-0 text-left' : 'right-0 text-right'
          }`}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <Link
            href="/transcribe"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition hover:bg-amber-500/10 hover:text-amber-300"
          >
            <span className="text-base">🎙️</span>
            <div>
              <span className="block font-medium">
                {isEn ? 'Audio to Text' : 'تبدیل صوت به متن'}
              </span>
              <span className="block text-[10px] text-white/40">
                {isEn ? 'Convert audio file to transcript' : 'تبدیل فایل صوتی به متن'}
              </span>
            </div>
          </Link>

          <Link
            href="/subtitle"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition hover:bg-amber-500/10 hover:text-amber-300"
          >
            <span className="text-base">🎬</span>
            <div>
              <span className="block font-medium">
                {isEn ? 'Subtitle Studio' : 'استودیو زیرنویس'}
              </span>
              <span className="block text-[10px] text-white/40">
                {isEn ? 'Auto captions for video & reels' : 'زیرنویس خودکار ویدیو و ریلز'}
              </span>
            </div>
          </Link>

          <Link
            href="/audio-enhancer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition hover:bg-amber-500/10 hover:text-amber-300"
          >
            <span className="text-base">🔊</span>
            <div>
              <span className="block font-medium">
                {isEn ? 'Audio Enhancer' : 'تقویت و شفاف‌ساز صدا'}
              </span>
              <span className="block text-[10px] text-white/40">
                {isEn ? 'Noise suppression & voice booster' : 'کاهش نویز و شفاف‌سازی با AI'}
              </span>
            </div>
          </Link>

          <Link
            href="/tools/bg-remover"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition hover:bg-amber-500/10 hover:text-amber-300"
          >
            <span className="text-base">🪄</span>
            <div>
              <span className="block font-medium">
                {isEn ? 'Remove Background' : 'حذف پس‌زمینه'}
              </span>
              <span className="block text-[10px] text-white/40">
                {isEn ? 'Smart transparent background' : 'حذف خودکار پس‌زمینه تصویر'}
              </span>
            </div>
          </Link>

          <Link
            href="/pdf-to-word"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition hover:bg-amber-500/10 hover:text-amber-300"
          >
            <span className="text-base">📑</span>
            <div>
              <span className="block font-medium">
                {isEn ? 'PDF to Word Converter' : 'تبدیل PDF به ورد هوشمند'}
              </span>
              <span className="block text-[10px] text-white/40">
                {isEn ? 'Extract scanned PDF with OCR' : 'استخراج متون اسکن و تصویری با OCR'}
              </span>
            </div>
          </Link>
        </div>
      )}
    </div>
  )
}

