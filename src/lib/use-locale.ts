'use client'

import { usePathname } from 'next/navigation'
import type { Locale } from '@/lib/i18n'

export function useLocale(): Locale {
  const pathname = usePathname() || '/'
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'fa'
}