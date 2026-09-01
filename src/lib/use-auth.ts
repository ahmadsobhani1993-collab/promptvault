'use client'

import { useEffect, useState } from 'react'

export type AuthState = 'checking' | 'ok' | 'no'

/**
 * بررسی ورود کاربر — با الگوهای رایج سایت
 * اگر سیستم لاگین سایت متفاوت بود، فقط این تابع را تنظیم کن.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>('checking')

  useEffect(() => {
    ;(async () => {
      try {
        // ۱) localStorage
        for (const k of ['token', 'user', 'session', 'auth', 'isLoggedIn']) {
          if (localStorage.getItem(k)) return setState('ok')
        }
        // ۲) cookie
        if (/(token|session|user|auth)=/.test(document.cookie)) return setState('ok')
        // ۳) endpoint های رایج
        for (const url of ['/api/auth/me', '/api/auth/session', '/api/me']) {
          try {
            const r = await fetch(url)
            if (r.ok) {
              const d = await r.json()
              if (d?.user || d?.email || d?.loggedIn || d?.username) return setState('ok')
            }
          } catch {}
        }
      } catch {}
      setState('no')
    })()
  }, [])

  return state
}
