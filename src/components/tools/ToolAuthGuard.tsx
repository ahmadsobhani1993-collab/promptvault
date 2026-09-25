'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/use-auth'

interface ToolAuthGuardProps {
  children: React.ReactNode
  toolName?: string
  description?: string
}

export default function ToolAuthGuard({
  children,
  toolName = 'این ابزار',
  description,
}: ToolAuthGuardProps) {
  const auth = useAuth()

  if (auth === 'checking') {
    return (
      <div className="container-app flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (auth === 'no') {
    return (
      <div className="container-app py-16" dir="rtl">
        <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#12100d]/95 p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-2xl shadow-inner">
            🔒
          </div>

          <h2 className="font-display text-xl md:text-2xl font-black text-white mb-3">
            ورود به حساب کاربری الزامی است
          </h2>

          <p className="text-xs md:text-sm text-stone-400 leading-relaxed mb-8 max-w-md mx-auto">
            {description || `برای استفاده از «${toolName}»، لطفاً وارد حساب خود شوید یا رایگان ثبت‌نام کنید.`}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold px-8 py-3 text-xs transition-all shadow-lg shadow-amber-500/20"
            >
              ورود به حساب
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto rounded-xl border border-white/15 bg-zinc-900 px-8 py-3 text-xs font-bold text-white hover:border-amber-500/50 hover:text-amber-400 transition-all"
            >
              ثبت‌نام رایگان
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
