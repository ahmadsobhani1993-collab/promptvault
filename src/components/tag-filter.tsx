'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function TagFilter({
  all,
  top,
  selected,
}: {
  all: string[]
  top: string[]
  selected: string[]
}) {
  const router = useRouter()
  const [q, setQ] = useState('')

  const apply = (tags: string[]) => {
    const query = new URLSearchParams(window.location.search)
    if (tags.length) query.set('tags', tags.join(','))
    else query.delete('tags')
    router.push('/explore?' + query.toString())
  }

  const toggle = (t: string) => {
    if (selected.includes(t)) apply(selected.filter((x) => x !== t))
    else if (selected.length < 2) apply([...selected, t])
  }

  const matches = q.trim() ? all.filter((t) => t.includes(q.trim())).slice(0, 10) : []
  const show = q.trim() ? matches : top

  return (
    <div className="mt-6">
      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-muted">فیلترهای فعال:</span>
          {selected.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className="flex items-center gap-1.5 rounded-full border border-gold bg-gold/15 px-3 py-1 text-xs text-gold-bright transition-colors hover:bg-gold/25"
            >
              {t}
              <span className="text-sm font-bold leading-none">×</span>
            </button>
          ))}
          <button type="button" onClick={() => apply([])} className="text-xs text-ink-faint transition-colors hover:text-danger">
            پاک کردن همه
          </button>
        </div>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="جستجوی تگ... (بقیه تگ‌ها را تایپ کن)"
        className="input max-w-xs"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {show.map((t) => {
          const active = selected.includes(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className={
                'rounded-full border px-3 py-1 text-xs transition-colors ' +
                (active
                  ? 'border-gold bg-gold/15 text-gold-bright'
                  : 'border-line bg-elevated text-ink-muted hover:border-gold/40 hover:text-gold-bright')
              }
            >
              {t}
            </button>
          )
        })}
        {q.trim() && show.length === 0 && (
          <span className="text-xs text-ink-faint">تگی یافت نشد.</span>
        )}
      </div>
    </div>
  )
}
