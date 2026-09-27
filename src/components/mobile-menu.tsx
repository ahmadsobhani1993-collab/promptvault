'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export default function MobileMenu({
  links,
  admin,
  isLoggedIn,
}: {
  links: { href: string; label: string }[]
  admin: boolean
  isLoggedIn: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button 
        type="button" 
        onClick={() => setOpen(!open)} 
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line/60 bg-surface/50 text-ink-muted transition-colors hover:border-gold/40 hover:text-gold-bright"
        aria-label="منو"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      {open && (
        <div className="fixed inset-x-3 top-20 z-50 rounded-2xl border border-line bg-[#0a0805] p-5 shadow-2xl">
          <div className="grid gap-4">
            {links.map((l) => (
              <Link 
                key={l.href} 
                href={l.href} 
                onClick={() => setOpen(false)} 
                className="text-sm text-ink-muted transition-colors hover:text-gold-bright"
              >
                {l.label}
              </Link>
            ))}
            {admin && (
              <Link 
                href="/admin" 
                onClick={() => setOpen(false)} 
                className="text-sm font-bold text-gold-bright"
              >
                 مدیریت
              </Link>
            )}
            
            {/* Logout / Submit buttons */}
            <div className="mt-2 flex gap-2 border-t border-line pt-4">
              {isLoggedIn ? (
                <Link 
                  href="/api/auth/signout" 
                  onClick={() => setOpen(false)} 
                  className="btn-secondary flex-1 text-center text-xs"
                >
                  خروج
                </Link>
              ) : (
                <Link 
                  href="/submit" 
                  onClick={() => setOpen(false)} 
                  className="btn-primary flex-1 text-center text-xs"
                >
                  ارسال پرامپت
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}