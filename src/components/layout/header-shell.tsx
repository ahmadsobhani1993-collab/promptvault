'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    let active = true
    let refreshTimer: ReturnType<typeof setInterval> | undefined

    const refreshNotifications = async () => {
      try {
        const response = await fetch('/api/notifications/recent', {
          credentials: 'same-origin',
          cache: 'no-store',
        })
        if (!response.ok) throw new Error(`Notification refresh failed (${response.status})`)
        const data = await response.json()
        if (active && Array.isArray(data.items)) setNotifications(data.items)
      } catch (error) {
        console.error('[Notifications] Failed to refresh in-app notifications:', error)
      }
    }

    if (!hasLoginHint()) {
      setSession(null)
      setNotifications([])
      try {
        localStorage.removeItem(HINT_KEY)
      } catch {}
      return () => { active = false }
    }

    try {
      const hint = localStorage.getItem(HINT_KEY)
      if (hint) setSession(JSON.parse(hint))
    } catch {}

    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Session refresh failed (${response.status})`)
        return response.json()
      })
      .then(async (data) => {
        const s = data && data.user ? data : null
        if (!active) return
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
          await refreshNotifications()
          refreshTimer = setInterval(() => { void refreshNotifications() }, 30000)
        } else {
          setNotifications([])
        }
      })
      .catch((error) => console.error('[Notifications] Failed to load session:', error))

    return () => {
      active = false
      if (refreshTimer) clearInterval(refreshTimer)
    }
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