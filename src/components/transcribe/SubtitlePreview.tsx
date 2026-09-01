'use client'

import { useEffect, useState } from 'react'
import type { TranscriptSegment } from '@/lib/live-transcribe'

const FONTS = [
  { id: 'Vazirmatn', label: 'وزیرمتن', css: "'Vazirmatn', sans-serif" },
  { id: 'Lalezar', label: 'لاله‌زار', css: "'Lalezar', sans-serif" },
  { id: 'Markazi Text', label: 'مرکزی', css: "'Markazi Text', serif" },
  { id: 'Noto Nastaliq Urdu', label: 'نستعلیق', css: "'Noto Nastaliq Urdu', serif" },
]

type Props = { videoUrl: string; segments: TranscriptSegment[] }

export default function SubtitlePreview({ videoUrl, segments }: Props) {
  const [time, setTime] = useState(0)
  const [font, setFont] = useState(FONTS[0])
  const [size, setSize] = useState(5)
  const [color, setColor] = useState('#ffffff')
  const [bg, setBg] = useState(true)
  const [pos, setPos] = useState<'bottom' | 'top'>('bottom')

  useEffect(() => {
    FONTS.forEach((f) => {
      const id = 'gf-' + f.id.replace(/\s+/g, '-')
      if (!document.getElementById(id)) {
        const l = document.createElement('link')
        l.id = id
        l.rel = 'stylesheet'
        l.href = `https://fonts.googleapis.com/css2?family=${f.id.replace(/ /g, '+')}&display=swap`
        document.head.appendChild(l)
      }
    })
  }, [])

  const current = segments.find((s) => time >= s.start && time <= s.end)

  return (
    <div className="card space-y-3 p-4">
      <strong className="text-sm">🎬 پیش‌نمایش و ادیتور زیرنویس</strong>

      <div className="relative overflow-hidden rounded-xl bg-black" style={{ containerType: 'inline-size' }}>
        <video
          src={videoUrl}
          controls
          playsInline
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          className="w-full"
        />
        {current && (
          <div
            className="pointer-events-none absolute inset-x-0 flex justify-center px-3"
            style={pos === 'bottom' ? { bottom: '4%' } : { top: '4%' }}
          >
            <span
              dir="auto"
              className="text-center"
              style={{
                fontFamily: font.css,
                fontSize: `clamp(14px, ${size}cqi, 52px)`,
                color,
                backgroundColor: bg ? 'rgba(0,0,0,0.65)' : 'transparent',
                padding: bg ? '0.2em 0.6em' : 0,
                borderRadius: '0.5em',
                textShadow: bg ? 'none' : '0 1px 4px rgba(0,0,0,0.9)',
              }}
            >
              {current.text}
            </span>
          </div>
        )}
      </div>

      {/* کنترل‌های استایل */}
      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div>
          <div className="mb-1 text-ink-muted">فونت</div>
          <div className="flex flex-wrap gap-1">
            {FONTS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFont(f)}
                className={`rounded px-2 py-1 ${font.id === f.id ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                style={{ fontFamily: f.css }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-ink-muted">اندازه: {size}</div>
          <input
            type="range"
            min={3}
            max={9}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <div className="mb-1 text-ink-muted">رنگ</div>
          <div className="flex gap-1">
            {['#ffffff', '#ffe14d', '#7CFC00', '#000000'].map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded border-2 ${color === c ? 'border-blue-500' : 'border-gray-600'}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
          </div>
        </div>
        <div>
          <div className="mb-1 text-ink-muted">پس‌زمینه / 위치</div>
          <div className="flex gap-1">
            <button
              onClick={() => setBg(!bg)}
              className={`rounded px-2 py-1 ${bg ? 'bg-blue-600 text-white' : 'bg-gray-700'}`}
            >
              پس‌زمینه
            </button>
            <button
              onClick={() => setPos(pos === 'bottom' ? 'top' : 'bottom')}
              className="rounded bg-gray-700 px-2 py-1 hover:bg-gray-600"
            >
              {pos === 'bottom' ? 'پایین' : 'بالا'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
