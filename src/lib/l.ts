import type { Locale } from '@/lib/i18n'

export function L(locale: Locale, fa: string, en?: string) {
  if (locale === 'en' && en) return en
  return fa
}