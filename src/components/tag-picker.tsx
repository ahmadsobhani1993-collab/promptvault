'use client'

import { useState } from 'react'

export default function TagPicker({ vocab, max = 4 }: { vocab: { fa: string; en: string }[]; max?: number }) {
  const [sel, setSel] = useState<number[]>([])
  const [q, setQ] = useState('')

  const list = q.trim()
    ? vocab.map((v, i) => ({ v, i })).filter(({ v }) => v.fa.includes(q.trim()) || v.en.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 10)
    : vocab.map((v, i) => ({ v, i })).slice(0, 12)

  const toggle = (i: number) => {
    setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : s.length < max ? [...s, i] : s))
  }

  return (
    <div className="grid gap-3">
      <input type="hidden" name="tagsFa" value={sel.map((i) => vocab[i].fa).join('، ')} />
      <input type="hidden" name="tagsEn" value={sel.map((i) => vocab[i].en).join(', ')} />

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="جستجوی تگ مجاز... (حداکثر " + max + ')'
        className="input"
      />

      {sel.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sel.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              className="flex items-center gap-1.5 rounded-full border border-gold bg-gold/15 px-3 py-1 text-xs text-gold-bright"
            >
              {vocab[i].fa}
              <span className="text-sm font-bold leading-none">×</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {list.map(({ v, i }) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={
              'rounded-full border px-3 py-1 text-xs transition-colors ' +
              (sel.includes(i)
                ? 'border-gold bg-gold/15 text-gold-bright'
                : 'border-line bg-elevated text-ink-muted hover:border-gold/40')
            }
          >
            {v.fa}
          </button>
        ))}
      </div>
    </div>
  )
}
