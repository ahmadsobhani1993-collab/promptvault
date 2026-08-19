'use client'

import { signOut } from 'next-auth/react'

export default function LogoutButton({ label = 'خروج' }: { label?: string }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/' })}
      className="btn-secondary"
    >
      {label}
    </button>
  )
}
