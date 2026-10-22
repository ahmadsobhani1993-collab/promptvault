'use client'

import { useState } from 'react'
import Link from 'next/link'

type Comment = {
  id: string
  parentId?: string | null
  userId?: string | null
  username?: string | null
  name: string
  image?: string | null
  text: string
  createdAt: string
}

export default function RealCommentBox({
  initial = [],
  initialComments,
  targetId,
  promptId,
  targetType = 'prompt',
  titleLabel = 'دیدگاه‌ها',
  textPlaceholder = 'دیدگاه یا تجربه خود را درباره این پرامپت بنویسید...',
  submitLabel = 'ثبت دیدگاه',
  loginRequired = 'برای ثبت نظر لطفاً وارد حساب خود شوید.',
  isLoggedIn = false,
}: {
  initial?: Comment[]
  initialComments?: Comment[]
  targetId?: string
  promptId?: string
  targetType?: 'prompt' | 'article'
  titleLabel?: string
  textPlaceholder?: string
  submitLabel?: string
  loginRequired?: string
  isLoggedIn?: boolean
}) {
  const effectiveInitial = Array.isArray(initial) && initial.length > 0 
    ? initial 
    : (Array.isArray(initialComments) ? initialComments : [])

  const [list, setList] = useState<Comment[]>(effectiveInitial)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)

  const effectiveTargetId = targetId || promptId || ''

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
      body: JSON.stringify({ 
        text: text.trim(), 
        targetId: effectiveTargetId, 
        targetType, 
        parentId: replyTo?.id ?? null 
      }),
    })
    if (res.ok) {
      const c = await res.json()
      setList((prev) => [c, ...(Array.isArray(prev) ? prev : [])])
      setText('')
      setReplyTo(null)
    }
  }

  const safeList = Array.isArray(list) ? list : []
  const roots = safeList.filter((c) => !c.parentId)
  const kids = (id: string) => safeList.filter((c) => c.parentId === id)

  const renderOne = (c: Comment, depth: number) => {
    const profileSlug = c.username || c.userId
    const profileUrl = profileSlug ? `/u/${profileSlug}` : null

    return (
      <div
        key={c.id}
        className={
          depth > 0
            ? 'mr-6 mt-3 rounded-xl border border-line/60 bg-elevated/60 p-4'
            : 'rounded-xl border border-line bg-elevated p-4'
        }
      >
        <div className="flex items-center justify-between text-xs text-ink-muted mb-2">
          <div className="flex items-center gap-2">
            {c.image ? (
              <img src={c.image} alt="" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <span className="w-6 h-6 rounded-full bg-gold/20 text-gold-bright flex items-center justify-center font-bold text-[10px]">
                {c.name?.[0] || 'U'}
              </span>
            )}
            {profileUrl ? (
              <Link href={profileUrl} className="font-bold text-ink hover:text-gold-bright transition-colors">
                {c.name}
              </Link>
            ) : (
              <span className="font-bold text-ink">{c.name}</span>
            )}
          </div>
          <span className="font-mono text-[11px] text-ink-faint">
            {c.createdAt ? new Date(c.createdAt).toLocaleDateString('fa-IR') : ''}
          </span>
        </div>

        <p className="text-sm text-ink leading-relaxed break-words whitespace-pre-wrap">{c.text}</p>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReplyTo(c)}
            className="text-xs text-gold-bright hover:underline"
          >
            پاسخ به این نظر
          </button>
        </div>

        {kids(c.id).map((kid) => renderOne(kid, depth + 1))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-ink flex items-center gap-2">
        <span>💬</span>
        <span>{titleLabel}</span>
        <span className="text-xs font-mono bg-surface px-2 py-0.5 rounded-full border border-line text-ink-muted">
          {safeList.length}
        </span>
      </h3>

      <form onSubmit={submit} className="space-y-3">
        {replyTo && (
          <div className="flex items-center justify-between bg-gold/10 border border-gold/30 px-3 py-1.5 rounded-xl text-xs text-gold-bright">
            <span>در حال پاسخ به: <strong>{replyTo.name}</strong></span>
            <button type="button" onClick={() => setReplyTo(null)} className="hover:text-red-400">✕ انصراف</button>
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={textPlaceholder}
          rows={3}
          className="w-full rounded-2xl border border-line bg-surface/50 p-3.5 text-sm text-ink placeholder:text-ink-muted/50 focus:border-gold focus:outline-none transition-colors"
        />

        <div className="flex justify-end">
          <button type="submit" className="btn-primary px-5 py-2 rounded-xl text-xs font-bold">
            {submitLabel}
          </button>
        </div>
      </form>

      <div className="space-y-3 pt-4">
        {roots.length === 0 ? (
          <p className="text-xs text-ink-muted text-center py-6 bg-surface/20 rounded-2xl border border-line/40">
            اولین نفری باشید که برای این پرامپت نظر ثبت می‌کند.
          </p>
        ) : (
          roots.map((root) => renderOne(root, 0))
        )}
      </div>
    </div>
  )
}
