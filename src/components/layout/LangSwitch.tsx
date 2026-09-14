'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function LangSwitch({ currentLocale }: { currentLocale: 'fa' | 'en' }) {
  const pathname = usePathname() || '/'

  // محاسبه آدرس نسخه فارسی
  const faPath = pathname.startsWith('/en')
    ? pathname.replace(/^\/en/, '') || '/'
    : pathname

  // محاسبه آدرس نسخه انگلیسی
  const enPath = pathname.startsWith('/en')
    ? pathname
    : `/en${pathname === '/' ? '' : pathname}`

  return (
    <div dir="ltr" className="flex items-center rounded-xl border border-white/10 bg-zinc-950/80 p-0.5 shadow-inner">
      <Link
        href={faPath}
        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
          currentLocale === 'fa'
            ? 'border border-amber-500/40 bg-amber-500/20 font-bold text-amber-300 shadow-sm'
            : 'text-zinc-400 hover:text-white'
        }`}
      >
        فارسی
      </Link>

      <Link
        href={enPath}
        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
          currentLocale === 'en'
            ? 'border border-amber-500/40 bg-amber-500/20 font-bold text-amber-300 shadow-sm'
            : 'text-zinc-400 hover:text-white'
        }`}
      >
        English
      </Link>
    </div>
  )
}
