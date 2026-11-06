'use client'

import { usePathname, useRouter } from 'next/navigation'
import { hasLocalizedRoute, localizedPath } from '@/lib/locale-path'

export default function LocaleSwitcher() {
  const router = useRouter()
  const pathname = usePathname() || '/'
  const currentLocale = pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'fa'

  const switchLocale = (locale: 'fa' | 'en') => {
    if (locale === currentLocale) return

    const unprefixedPath = currentLocale === 'en' ? pathname.slice(3) || '/' : pathname
    const targetPath = hasLocalizedRoute(unprefixedPath)
      ? localizedPath(locale, unprefixedPath)
      : locale === 'en' ? '/en' : '/'

    document.cookie = `locale=${locale}; path=/; max-age=31536000; SameSite=Lax`
    router.push(`${targetPath}${window.location.search}${window.location.hash}`)
  }

  return (
    <>
      <div className="hidden md:flex items-center gap-1 rounded-full border border-line bg-elevated px-1.5 py-1 text-xs">
        <button
          type="button"
          onClick={() => switchLocale('fa')}
          className={`rounded-full px-2.5 py-0.5 font-bold transition-colors ${
            currentLocale === 'fa' ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-gold-bright'
          }`}
        >
          فارسی
        </button>
        <button
          type="button"
          onClick={() => switchLocale('en')}
          className={`rounded-full px-2.5 py-0.5 font-bold transition-colors ${
            currentLocale === 'en' ? 'bg-gold/20 text-gold-bright' : 'text-ink-muted hover:text-gold-bright'
          }`}
        >
          English
        </button>
      </div>

      <button
        type="button"
        onClick={() => switchLocale(currentLocale === 'fa' ? 'en' : 'fa')}
        className="md:hidden flex items-center gap-0.5 rounded-full border border-line bg-elevated px-2 py-1 text-[10px] font-bold transition-colors hover:border-gold/40"
      >
        <span className={currentLocale === 'fa' ? 'text-gold-bright' : 'text-ink-muted'}>FA</span>
        <span className="text-line/60">/</span>
        <span className={currentLocale === 'en' ? 'text-gold-bright' : 'text-ink-muted'}>EN</span>
      </button>
    </>
  )
}