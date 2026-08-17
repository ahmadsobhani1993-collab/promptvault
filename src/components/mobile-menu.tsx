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
    <div className="relative lg:hidden">
      <button type="button" onClick={() => setOpen(!open)} className="btn-secondary px-3 py-1.5" aria-label="منو">
        ☰
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-50 w-64 rounded-2xl border border-line bg-[#0a0805] p-5 shadow-2xl">
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
      )}
    </div>
  )
}
