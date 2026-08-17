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
