'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type N = { id: string; text: string; url: string; read: boolean; createdAt: string }

export default function NotifBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<N[]>([])
  const [unread, setUnread] = useState(0)
  const [permission, setPermission] = useState<string>('default')
  const [fa, setFa] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setFa(document.documentElement.lang !== 'en')
    if ('Notification' in window) setPermission(Notification.permission)
  }, [])

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

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && unread > 0) { setUnread(0); await fetch('/api/notifications/read', { method: 'POST' }).catch(() => {}) }
  }

  const enable = async () => {
    const p = await Notification.requestPermission()
    setPermission(p)
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={toggle} className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-elevated text-ink-muted transition-colors hover:text-gold-bright" aria-label="اعلان‌ها">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className="absolute -left-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-50 rounded-2xl border border-line bg-[#0a0805] p-3 shadow-2xl sm:absolute sm:inset-x-auto sm:top-12 sm:left-0 sm:w-80">
          <p className="px-2 pb-2 text-xs font-bold text-gold-bright">{fa ? 'اعلان‌ها' : 'Notifications'}</p>
          {'Notification' in window && permission === 'default' && (
            <button type="button" onClick={enable} className="btn-primary mb-2 w-full justify-center text-xs">
              {fa ? 'فعال‌سازی نوتیفیکیشن' : 'Enable notifications'}
            </button>
          )}
          {items.length === 0 ? (
            <p className="px-2 pb-2 text-[11px] text-ink-faint">{fa ? 'اعلانی نداری.' : 'No notifications.'}</p>
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
      )}
    </div>
  )
}
