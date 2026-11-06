import { cookies, headers } from 'next/headers'
import type { Locale } from '@/lib/i18n'

export async function getRequestLocale(): Promise<Locale> {
  const requestHeaders = await headers()
  const locale = requestHeaders.get('x-locale')

  if (locale === 'fa' || locale === 'en') return locale

  const cookieStore = await cookies()
  return cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
}
