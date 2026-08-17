'use client'

import { signOut } from 'next-auth/react'

export default function LogoutButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => signOut({ callbackUrl: '/' })} className="btn-secondary">
      {label}
    </button>
  )
}
