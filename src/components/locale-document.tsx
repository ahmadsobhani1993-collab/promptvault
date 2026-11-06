'use client'

import { useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function LocaleDocument() {
  const pathname = usePathname() || '/'

  useLayoutEffect(() => {
    const isEnglish = pathname === '/en' || pathname.startsWith('/en/')
    const html = document.documentElement
    html.lang = isEnglish ? 'en' : 'fa'
    html.dir = isEnglish ? 'ltr' : 'rtl'
    document.body.classList.toggle('font-sans', !isEnglish)
  }, [pathname])

  return null
}
