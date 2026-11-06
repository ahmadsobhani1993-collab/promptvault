import type { Locale } from '@/lib/i18n'

export function hasLocalizedRoute(pathname: string): boolean {
  return (
    pathname === '/' ||
    /^\/(explore|categories|blog|news|prompts|login|submit|account|subtitle|transcribe|tools|audio-enhancer|pdf-to-word)$/.test(pathname) ||
    /^\/(categories|blog|prompts|u)\/[^/]+$/.test(pathname) ||
    pathname === '/tools/bg-remover'
  )
}

export function localizedPath(locale: Locale, pathname: string): string {
  const suffixIndex = pathname.search(/[?#]/)
  const suffix = suffixIndex < 0 ? '' : pathname.slice(suffixIndex)
  const originalPath = suffixIndex < 0 ? pathname : pathname.slice(0, suffixIndex)
  const path = originalPath.startsWith('/en/')
    ? originalPath.slice(3)
    : originalPath === '/en'
      ? '/'
      : originalPath
  if (locale !== 'en' || !hasLocalizedRoute(path)) return `${path}${suffix}`
  return `${path === '/' ? '/en' : `/en${path}`}${suffix}`
}
