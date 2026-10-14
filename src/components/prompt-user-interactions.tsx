'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import RealLikeButton from '@/components/real-like-button'
import SaveButton from '@/components/save-button'
import ShareButtons from '@/components/share-buttons'
import PromptReveal from '@/components/prompt-reveal'
import { L } from '@/lib/data'
import type { Locale } from '@/lib/i18n'

interface PromptUserInteractionsProps {
  promptId: string
  slug: string
  initialLikes: number
  initialSaves: number
  pageHeading: string
  desc: string
  locale: Locale
}

export default function PromptUserInteractions({
  promptId,
  slug,
  initialLikes,
  initialSaves,
  pageHeading,
  desc,
  locale,
}: PromptUserInteractionsProps) {
  const [session, setSession] = useState<{ userId?: string } | null>(null)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function checkUserStatus() {
      try {
        const res = await fetch(`/api/prompts/${slug}/user-status`)
        if (res.ok) {
          const data = await res.json()
          if (isMounted) {
            setSession(data.session)
            setLiked(data.liked)
            setSaved(data.saved)
          }
        }
      } catch (e) {
        console.error('Error fetching user status:', e)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    checkUserStatus()
    return () => {
      isMounted = false
    }
  }, [slug])

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <RealLikeButton
          promptId={promptId}
          initialLiked={liked}
          initialCount={initialLikes}
          label={L(locale, 'پسند', 'likes')}
          requireLogin={L(locale, 'برای لایک کردن ابتدا وارد شو', 'Login to like')}
        />
        <SaveButton
          promptId={promptId}
          initialSaved={saved}
          initialCount={initialSaves}
          label={L(locale, 'ذخیره', 'saves')}
          requireLogin={L(locale, 'برای ذخیره کردن ابتدا وارد شو', 'Login to save')}
        />
        <ShareButtons title={pageHeading} desc={desc} />
      </div>

      {loading ? (
        <div className="mt-8 h-28 w-full animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : session?.userId ? (
        <PromptReveal
          slug={slug}
          revealLabel={L(locale, 'نمایش پرامپت', 'Reveal Prompt')}
          copyLabel={L(locale, 'کپی پرامپت', 'Copy Prompt')}
          copiedLabel={L(locale, 'کپی شد!', 'Copied!')}
          hint={L(locale, 'پرامپت برای محافظت در برابر اسکرپینگ، فقط بعد از کلیک نمایش داده می‌شود.', 'The prompt is revealed on click to protect against scraping.')}
          locale={locale}
        />
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-gold/40 bg-gold/5 p-6 text-center">
          <p className="text-sm text-ink-muted">
            {L(locale, 'برای مشاهده و کپی کردن متن پرامپت، ابتدا باید وارد حساب کاربری خود شوید.', 'To view and copy the prompt text, you must first log in to your account.')}
          </p>
          <Link href="/login" className="btn-primary mt-4 inline-flex">
            {L(locale, 'ورود به حساب کاربری', 'Login to Account')}
          </Link>
        </div>
      )}
    </>
  )
}