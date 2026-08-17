#!/bin/bash
set -e

# ---------- 1) mobile menu: full sheet + outside click ----------
cat > src/components/mobile-menu.tsx << 'EOF'
'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function MobileMenu({
  links,
  admin,
}: {
  links: { href: string; label: string }[]
  admin: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(!open)} className="btn-secondary px-3 py-1.5" aria-label="منو">
        ☰
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-3 top-20 z-50 rounded-2xl border border-line bg-[#0a0805] p-5 shadow-2xl">
            <div className="grid gap-4">
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
                  {l.label}
                </Link>
              ))}
              {admin && (
                <Link href="/admin" onClick={() => setOpen(false)} className="text-sm font-bold text-gold-bright">
                  🛠 مدیریت
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
EOF

# ---------- 2) notif bell: in-screen + outside click ----------
cat > src/components/notif-bell.tsx << 'EOF'
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type N = { id: string; text: string; url: string; read: boolean; createdAt: string }

export default function NotifBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<N[]>([])
  const [unread, setUnread] = useState(0)

  const load = async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const j = await res.json()
        setItems(j.items)
        setUnread(j.unread)
      }
    } catch {}
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      setUnread(0)
      await fetch('/api/notifications/read', { method: 'POST' }).catch(() => {})
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={toggle} className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-elevated text-ink-muted transition-colors hover:text-gold-bright" aria-label="اعلان‌ها">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -left-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-3 top-16 z-50 rounded-2xl border border-line bg-[#0a0805] p-3 shadow-2xl sm:absolute sm:inset-x-auto sm:top-12 sm:left-0 sm:w-80">
            <p className="px-2 pb-2 text-xs font-bold text-gold-bright">اعلان‌ها</p>
            {items.length === 0 ? (
              <p className="px-2 pb-2 text-[11px] text-ink-faint">اعلانی نداری.</p>
            ) : (
              <div className="max-h-80 space-y-1 overflow-auto">
                {items.map((n) => (
                  <Link key={n.id} href={n.url} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 transition-colors hover:bg-elevated">
                    <p className="text-[11px] leading-5 text-ink-muted">{n.text}</p>
                    <p className="mt-1 text-[9px] text-ink-faint">{n.createdAt}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
EOF

# ---------- 3) down button: hide with animation at bottom ----------
cat > src/components/down-button.tsx << 'EOF'
'use client'

import { useEffect, useState } from 'react'

export default function DownButton() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80
      setHidden(nearBottom)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      aria-label="پایین"
      onClick={() => window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' })}
      className={
        'fixed bottom-6 left-1/2 z-30 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-full border border-gold/50 bg-[#0a0805]/80 text-gold-bright backdrop-blur transition-all duration-700 ' +
        (hidden ? 'pointer-events-none translate-y-20 rotate-180 scale-50 opacity-0' : 'opacity-100')
      }
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  )
}
EOF

# ---------- 4) PWA controls: centered row (not fixed corner) ----------
cat > src/components/pwa-controls.tsx << 'EOF'
'use client'

import { useEffect, useState } from 'react'

export default function PWAControls() {
  const [installEvt, setInstallEvt] = useState<any>(null)
  const [permission, setPermission] = useState<string>('default')

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission)
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
    const handler = (e: any) => {
      e.preventDefault()
      setInstallEvt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  return (
    <div className="container-app flex flex-wrap items-center justify-center gap-3 pb-10">
      {installEvt && (
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            installEvt.prompt?.()
            setInstallEvt(null)
          }}
        >
          📲 نصب اپ
        </button>
      )}
      {'Notification' in window && permission === 'default' && (
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            const p = await Notification.requestPermission()
            setPermission(p)
            if (p === 'granted') {
              try { new Notification('PromptsFA', { body: 'اعلان‌ها فعال شدند ✅' }) } catch {}
            }
          }}
        >
          🔔 فعال‌سازی نوتیفیکیشن
        </button>
      )}
    </div>
  )
}
EOF

# ---------- 5) hero search: no placeholder + lighter text ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/hero.tsx'
let s = fs.readFileSync(p, 'utf8')
s = s.replace(
  /<input\n\s+name="q"\n\s+placeholder=\{placeholder\}\n\s+className="[^"]*"\n\s+\/>/,
  '<input\n              name="q"\n              className="w-full bg-transparent text-base text-[#cfc8b8] outline-none placeholder:text-[#8f887a]"\n            />'
)
fs.writeFileSync(p, s)
console.log('✅ hero input: placeholder removed + lighter text')
NODEEOF

# ---------- 6) login page: localized + LTR for EN ----------
cat > src/app/login/page.tsx << 'EOF'
import { cookies } from 'next/headers'
import { signIn } from '@/auth'

export const metadata = { title: 'ورود | PromptsFA' }

export default async function LoginPage() {
  const cookieStore = await cookies()
  const fa = cookieStore.get('locale')?.value !== 'en'

  return (
    <section className="container-app grid min-h-[70vh] place-items-center py-16" dir={fa ? 'rtl' : 'ltr'}>
      <div className={'card w-full max-w-md p-8 ' + (fa ? 'text-right' : 'text-left')}>
        <span className="gold-badge">{fa ? 'اعضا' : 'Members'}</span>
        <h1 className="mt-4 font-display text-3xl font-extrabold">{fa ? 'ورود' : 'Sign in'}</h1>
        <p className="mt-3 text-sm leading-7 text-ink-muted">
          {fa ? 'برای ادامه از حساب گوگل خود استفاده کنید.' : 'Use your Google account to continue.'}
        </p>
        <form
          action={async () => {
            'use server'
            await signIn('google', { redirectTo: '/' })
          }}
          className="mt-6"
        >
          <button type="submit" className="btn-primary w-full justify-center">Continue with Google</button>
        </form>
      </div>
    </section>
  )
}
EOF

echo "✅ update73 done!"