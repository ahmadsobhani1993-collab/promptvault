'use client'

import { useTransition } from 'react'

export default function LangSwitch({ currentLocale }: { currentLocale: 'fa' | 'en' }) {
  const [isPending, startTransition] = useTransition()

  const switchLanguage = (targetLocale: 'fa' | 'en') => {
    if (targetLocale === currentLocale) return

    startTransition(() => {
      // ست کردن کوکی در مرورگر برای ماندگاری زبان
      document.cookie = `locale=${targetLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
      
      const url = new URL(window.location.href)
      url.searchParams.delete('locale')
      window.location.href = url.pathname + url.search
    })
  }

  return (
    <div dir="ltr" className="flex items-center rounded-xl border border-white/10 bg-zinc-950/80 p-0.5 shadow-inner">
      <button
        type="button"
        disabled={isPending}
        onClick={() => switchLanguage('fa')}
        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
          currentLocale === 'fa'
            ? 'border border-amber-500/40 bg-amber-500/20 font-bold text-amber-300 shadow-sm'
            : 'text-zinc-400 hover:text-white'
        }`}
      >
        فارسی
      </button>

      <button
        type="button"
        disabled={isPending}
        onClick={() => switchLanguage('en')}
        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
          currentLocale === 'en'
            ? 'border border-amber-500/40 bg-amber-500/20 font-bold text-amber-300 shadow-sm'
            : 'text-zinc-400 hover:text-white'
        }`}
      >
        English
      </button>
    </div>
  )
}
