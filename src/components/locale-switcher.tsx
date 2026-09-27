'use client'

import { usePathname, useRouter } from 'next/navigation'

export default function LocaleSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  
  // تشخیص ایمن زبان فعلی
  const currentLocale = pathname.startsWith('/en') ? 'en' : 'fa'

  const switchLocale = (locale: 'fa' | 'en') => {
    let newPath = pathname
    if (locale === 'en') {
      if (!pathname.startsWith('/en')) newPath = '/en' + pathname
    } else {
      if (pathname.startsWith('/en')) newPath = pathname.replace(/^\/en/, '')
    }
    router.push(newPath)
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