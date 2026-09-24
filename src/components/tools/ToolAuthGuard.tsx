'use client'

import React from 'react'
import Link from 'next/link'

interface AuthGuardProps {
  children: React.ReactNode
  toolName: string
}

export default function ToolAuthGuard({ children, toolName }: AuthGuardProps) {
  // بررسی توکن یا سشن ورود (مطابق ساختار سیستم احراز هویت فعلی سایت)
  // در صورتی که از کوکی یا localStorage برای سشن استفاده می‌کنید بررسی می‌شود
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json().catch(() => null)
        setIsAuthenticated(Boolean(res.ok && data?.user))
      } catch {
        setIsAuthenticated(false)
      }
    }
    checkAuth()
  }, [])

  if (isAuthenticated === null) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-400">
        در حال بررسی دسترسی...
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-500/20 bg-zinc-950 p-8 text-center text-white shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-2xl text-amber-400">
          🔒
        </div>
        <h3 className="mb-2 text-xl font-black text-amber-400">ورود به حساب کاربری الزامی است</h3>
        <p className="mb-6 text-sm leading-relaxed text-zinc-400">
          برای استفاده از ابزار <span className="font-bold text-white">«{toolName}»</span> و دسترسی به پردازش هوش مصنوعی، لطفاً وارد حساب خود شوید یا ثبت‌نام کنید.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-bold text-black transition hover:bg-amber-400"
          >
            ورود به حساب
          </Link>
          <Link
            href="/register"
            className="rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
          >
            ثبت‌نام رایگان
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
