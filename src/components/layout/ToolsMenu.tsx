'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function ToolsMenu() {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition hover:border-amber-500/40 hover:text-amber-300"
      >
        ابزارها
        <span className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur">
          <Link
            href="/transcribe"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition hover:bg-amber-500/10 hover:text-amber-300"
          >
            <span className="text-base">🎙️</span>
            <span>
              تبدیل صوت به متن
              <span className="block text-[10px] text-white/40">تبدیل فایل صوتی</span>
            </span>
          </Link>
          <Link
            href="/subtitle"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition hover:bg-amber-500/10 hover:text-amber-300"
          >
            <span className="text-base">🎬</span>
            <span>
              زیرنویس اینستاگرام
              <span className="block text-[10px] text-white/40">زیرنویس خودکار ویدیو</span>
            </span>
          </Link>
        </div>
      )}
    </div>
  )
}
