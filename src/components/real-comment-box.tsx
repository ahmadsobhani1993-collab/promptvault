'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n'
import { localizedPath } from '@/lib/locale-path'

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
titleLabel,
textPlaceholder,
submitLabel,
loginRequired,
  isLoggedIn = false,
locale = 'fa',
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
locale?: Locale
}) {
  const effectiveInitial = Array.isArray(initial) && initial.length > 0 
    ? initial 
    : (Array.isArray(initialComments) ? initialComments : [])
const labels = {
title: titleLabel ?? (locale === 'en' ? 'Comments' : 'دیدگاه‌ها'),
placeholder: textPlaceholder ?? (locale === 'en' ? 'Share your thoughts or experience with this prompt...' : 'دیدگاه یا تجربه خود را درباره این پرامپت بنویسید...'),
submit: submitLabel ?? (locale === 'en' ? 'Post comment' : 'ثبت دیدگاه'),
login: loginRequired ?? (locale === 'en' ? 'Please sign in to leave a comment.' : 'برای ثبت نظر لطفاً وارد حساب خود شوید.'),
}

  const [list, setList] = useState<Comment[]>(effectiveInitial)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)

  const effectiveTargetId = targetId || promptId || ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    if (!isLoggedIn) {
alert(labels.login)
window.location.href = localizedPath(locale, '/login')
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
const profileUrl = profileSlug ? localizedPath(locale, `/u/${profileSlug}`) : null

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
{c.createdAt ? new Date(c.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'fa-IR') : ''}
          </span>
        </div>

        <p className="text-sm text-ink leading-relaxed break-words whitespace-pre-wrap">{c.text}</p>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReplyTo(c)}
            className="text-xs text-gold-bright hover:underline"
          >
{locale === 'en' ? 'Reply' : 'پاسخ به این نظر'}
          </button>
        </div>

        {kids(c.id).map((kid) => renderOne(kid, depth + 1))}
      </div>
    )
  }

return (
<div className="space-y-6">
      <form onSubmit={submit} className="rounded-2xl border border-gold/20 bg-gradient-to-br from-surface via-surface/95 to-gold/5 p-4 shadow-card md:p-5">
        <label htmlFor="comment-text" className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-base">✍️</span>
          <span>{locale === 'en' ? 'Write your comment' : 'دیدگاه خود را بنویسید'}</span>
        </label>

        {replyTo && (
          <div className="flex items-center justify-between bg-gold/10 border border-gold/30 px-3 py-1.5 rounded-xl text-xs text-gold-bright">
<span>{locale === 'en' ? 'Replying to:' : 'در حال پاسخ به:'} <strong>{replyTo.name}</strong></span>
<button type="button" onClick={() => setReplyTo(null)} className="hover:text-red-400">{locale === 'en' ? '✕ Cancel' : '✕ انصراف'}</button>
          </div>
        )}

        <textarea
          id="comment-text"
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
placeholder={labels.placeholder}
          rows={4}
          className="min-h-32 w-full resize-y rounded-xl border border-line-strong bg-[#09090B]/80 px-4 py-3.5 text-sm leading-7 !text-[#F4EFE6] caret-gold placeholder:!text-[#A1A1AA] shadow-inner transition-colors focus:border-gold/70 focus:bg-[#0B0B0D] focus:outline-none focus:ring-4 focus:ring-gold/10"
        />

<div dir="ltr" className="mt-3 flex flex-wrap items-center justify-between gap-3">
  <button type="submit" className="inline-flex min-h-12 w-auto shrink-0 items-center justify-center rounded-xl border border-gold/70 bg-gold px-8 py-3 text-sm font-extrabold text-[#171512] shadow-gold-glow transition hover:bg-gold-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70">
    {labels.submit}
  </button>
  <p dir={locale === 'en' ? 'ltr' : 'rtl'} className="text-[11px] leading-5 text-ink-faint">
    {locale === 'en' ? 'Keep it kind and helpful to the community.' : 'لطفاً دیدگاه خود را محترمانه و مفید بنویسید.'}
  </p>
        </div>
      </form>

      <div className="flex items-center justify-between border-b border-line/60 pb-3">
        <h3 className="flex items-center gap-2 text-base font-bold text-ink">
          <span aria-hidden="true">💬</span>
          <span>{labels.title}</span>
        </h3>
        <span className="rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-xs font-semibold tabular-nums text-gold-bright">
          {safeList.length} {locale === 'en' ? 'comments' : 'دیدگاه'}
        </span>
      </div>

      <div className="space-y-3 pt-4">
        {roots.length === 0 ? (
          <p className="text-xs text-ink-muted text-center py-6 bg-surface/20 rounded-2xl border border-line/40">
{locale === 'en' ? 'Be the first to comment on this prompt.' : 'اولین نفری باشید که برای این پرامپت نظر ثبت می‌کند.'}
          </p>
        ) : (
          roots.map((root) => renderOne(root, 0))
        )}
      </div>
    </div>
  )
}
