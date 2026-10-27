'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { Locale } from '@/lib/i18n'

// Starts as 'fa' on server and first client render (no hydration mismatch),
// then switches to 'en' on /en URLs right after mount.
export function useLocale(): Locale {
  const pathname = usePathname() || '/'
  const [locale, setLocale] = useState<Locale>('fa')

  useEffect(() => {
    const p = window.location.pathname
    setLocale(p === '/en' || p.startsWith('/en/') ? 'en' : 'fa')
  }, [pathname])

  return locale
}