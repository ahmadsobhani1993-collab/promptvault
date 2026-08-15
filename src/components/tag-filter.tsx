'use client'

import { useRouter } from 'next/navigation'

export default function TagFilter({ all, selected }: { all: string[]; selected: string[] }) {
  const router = useRouter()

  const apply = (tags: string[]) => {
    const q = new URLSearchParams(window.location.search)
    if (tags.length) q.set('tags', tags.join(','))
    else q.delete('tags')
    router.push('/explore?' + q.toString())
  }

  const toggle = (t: string) => {
    if (selected.includes(t)) apply(selected.filter((x) => x !== t))
    else if (selected.length < 2) apply([...selected, t])
  }

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

      <div className="flex flex-wrap gap-2">
        {all.map((t) => {
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
      </div>
    </div>
  )
}
