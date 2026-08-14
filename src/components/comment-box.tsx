'use client'

import { useState } from 'react'

type Comment = { name: string; text: string }

export default function CommentBox({
  initial,
  titleLabel,
  namePlaceholder,
  textPlaceholder,
  submitLabel,
}: {
  initial: Comment[]
  titleLabel: string
  namePlaceholder: string
  textPlaceholder: string
  submitLabel: string
}) {
  const [list, setList] = useState<Comment[]>(initial)
  const [name, setName] = useState('')
  const [text, setText] = useState('')

  return (
    <div className="card mt-10 p-6">
      <h3 className="font-display text-lg font-bold">{titleLabel}</h3>

      <div className="mt-5 space-y-4">
        {list.map((c, i) => (
          <div key={c.name + i} className="rounded-xl border border-line bg-elevated p-4">
            <p className="text-xs font-bold text-gold-bright">{c.name}</p>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{c.text}</p>
          </div>
        ))}
      </div>

      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          setList([...list, { name: name.trim() || 'مهمان', text: text.trim() }])
          setText('')
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={namePlaceholder}
          className="input"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={textPlaceholder}
          rows={3}
          className="input resize-none"
        />
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
      </form>
    </div>
  )
}
