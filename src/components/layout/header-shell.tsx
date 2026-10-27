'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { hasLoginHint } from '@/lib/login-hint'
import { useLocale } from '@/lib/use-locale'
import MobileHeader from '@/components/mobile-header'
import DesktopHeader, { type HeaderCategory } from '@/components/desktop-header'

const HINT_KEY = 'pf_session_hint'

export default function HeaderShell({ categories }: { categories: HeaderCategory[] }) {
  const pathname = usePathname() || '/'
  const locale = useLocale()

  const [session, setSession] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const loadedRef = useRef(false)

  useEffect(() => {
    // Anonymous visitor: no network calls at all
    if (!hasLoginHint()) {
      if (loadedRef.current) {
        loadedRef.current = false
        setSession(null)
        setNotifications([])
      }
      try {
        localStorage.removeItem(HINT_KEY)
      } catch {}
      return
    }

    if (loadedRef.current) return
    loadedRef.current = true

    // Show last known login state immediately to avoid a flash
    try {
      const hint = localStorage.getItem(HINT_KEY)
      if (hint) setSession(JSON.parse(hint))
    } catch {}

    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const s = data && data.user ? data : null
        setSession(s)
        try {
          if (s) {
            localStorage.setItem(
              HINT_KEY,
              JSON.stringify({
                user: { id: s.user.id, name: s.user.name, image: s.user.image, role: s.user.role },
                expires: s.expires,
              })
            )
          } else {
            localStorage.removeItem(HINT_KEY)
          }
        } catch {}

        if (s) {
          fetch('/api/notifications/recent', { credentials: 'same-origin' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d && Array.isArray(d.items)) setNotifications(d.items)
            })
            .catch(() => {})
        }
      })
      .catch(() => {})
  }, [pathname])

  return (
    <>
      <MobileHeader locale={locale} session={session} notifications={notifications} />
      <DesktopHeader
        locale={locale}
        session={session}
        notifications={notifications}
        categories={categories}
      />
    </>
  )
}