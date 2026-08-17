'use client'

import { useState } from 'react'

type Comment = {
  id: string
  parentId?: string | null
  name: string
  image?: string | null
  text: string
  createdAt: string
}

export default function RealCommentBox({
  initial,
  targetId,
  targetType,
  titleLabel,
  textPlaceholder,
  submitLabel,
  loginRequired,
  isLoggedIn,
}: {
  initial: Comment[]
  targetId: string
  targetType: 'prompt' | 'article'
  titleLabel: string
  textPlaceholder: string
  submitLabel: string
  loginRequired: string
  isLoggedIn: boolean
}) {
  const [list, setList] = useState<Comment[]>(initial)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    if (!isLoggedIn) {
      alert(loginRequired)
      window.location.href = '/login'
      return
    }
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), targetId, targetType, parentId: replyTo?.id ?? null }),
    })
    if (res.ok) {
      const c = await res.json()
      setList([c, ...list])
      setText('')
      setReplyTo(null)
    }
  }

  const roots = list.filter((c) => !c.parentId)
  const kids = (id: string) => list.filter((c) => c.parentId === id)

  const renderOne = (c: Comment, depth: number) => (
    <div key={c.id} className={depth > 0 ? 'mr-6 mt-3 rounded-xl border border-line/60 bg-elevated/60 p-4' : 'rounded-xl border border-line bg-elevated p-4'}>
      <div className="flex items-center gap-3">
        {c.image ? (
          <img src={c.image} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gold/20 text-xs font-bold text-gold-bright">{c.name[0]}</div>
        )}
        <div>
          <p className="text-xs font-bold text-gold-bright">{c.name}</p>
          <p className="text-[10px] text-ink-faint">{c.createdAt}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-ink-muted">{c.text}</p>
      <button type="button" onClick={() => setReplyTo(c)} className="mt-2 text-[11px] text-ink-faint transition-colors hover:text-gold-bright">
        ↩️ پاسخ
      </button>
      {kids(c.id).map((k) => renderOne(k, Math.min(depth + 1, 2)))}
    </div>
  )

  return (
    <div className="card mt-10 p-6">
      <h3 className="font-display text-lg font-bold">{titleLabel}</h3>

      <form className="mt-5 space-y-3" onSubmit={submit}>
        {replyTo && (
          <p className="text-[11px] text-gold-bright">
            در پاسخ به «{replyTo.name}»{' '}
            <button type="button" onClick={() => setReplyTo(null)} className="text-ink-faint hover:text-danger">✕ انصراف</button>
          </p>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={textPlaceholder}
          rows={3}
          className="input resize-none"
        />
        <button type="submit" className="btn-primary">{submitLabel}</button>
      </form>

      <div className="mt-6 space-y-4">{roots.map((c) => renderOne(c, 0))}</div>
    </div>
  )
}
