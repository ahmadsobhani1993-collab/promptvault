'use client'

import { useEffect, useState } from 'react'
import type { Locale } from '@/lib/i18n'

const PERSIAN_EXAMPLES = [
  'ساخت لوگو مینیمال برای کافه...',
  'نوشتن سناریو ریلز اینستاگرام...',
  'پرامپت عکاسی پرتره سینمایی...',
]

export default function HeroSearchPlaceholder({
  locale,
  fallback,
  ariaLabel,
  className,
}: {
  locale: Locale
  fallback: string
  ariaLabel: string
  className: string
}) {
  const [placeholder, setPlaceholder] = useState(fallback)

  useEffect(() => {
    if (locale !== 'fa' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPlaceholder(locale === 'fa' ? PERSIAN_EXAMPLES[0] : fallback)
      return
    }

    let phraseIndex = 0
    let characterIndex = 0
    let deleting = false
    let timeout: ReturnType<typeof setTimeout>

    const type = () => {
      const phrase = PERSIAN_EXAMPLES[phraseIndex]
      characterIndex += deleting ? -1 : 1
      setPlaceholder(phrase.slice(0, characterIndex))

      if (!deleting && characterIndex === phrase.length) {
        deleting = true
        timeout = setTimeout(type, 1500)
      } else if (deleting && characterIndex === 0) {
        deleting = false
        phraseIndex = (phraseIndex + 1) % PERSIAN_EXAMPLES.length
        timeout = setTimeout(type, 350)
      } else {
        timeout = setTimeout(type, deleting ? 35 : 65)
      }
    }

    setPlaceholder('')
    timeout = setTimeout(type, 300)
    return () => clearTimeout(timeout)
  }, [fallback, locale])

  return (
    <input
      name="q"
      aria-label={ariaLabel}
      dir={locale === 'fa' ? 'rtl' : 'ltr'}
      className={className}
      placeholder={placeholder}
    />
  )
}
