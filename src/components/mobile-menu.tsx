'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export default function MobileMenu({
  links,
  admin,
}: {
  links: { href: string; label: string }[]
  admin: boolean
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
    <div className="relative lg:hidden" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} className="btn-secondary px-3 py-1.5" aria-label="منو">☰</button>
      {open && (
        <div className="fixed inset-x-3 top-20 z-50 rounded-2xl border border-line bg-[#0a0805] p-5 shadow-2xl">
          <div className="grid gap-4">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
                {l.label}
              </Link>
            ))}
            {admin && (
              <Link href="/admin" onClick={() => setOpen(false)} className="text-sm font-bold text-gold-bright">🛠 مدیریت</Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
