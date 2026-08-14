'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import type { Locale } from '@/lib/i18n'

export function LanguageToggle({
  locale,
  label,
}: {
  locale: Locale
  label: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const next: Locale = locale === 'fa' ? 'en' : 'fa'

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          document.cookie = 'locale=' + next + '; path=/; max-age=31536000'
          router.refresh()
        })
      }
      className="btn-secondary px-3 py-1.5 text-xs"
    >
      {label}
    </button>
  )
}
