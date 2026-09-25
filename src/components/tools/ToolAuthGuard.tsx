'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'

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
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="container-app flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="container-app py-16">
        <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-line/60 bg-[#12100d]/90 p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/40 bg-gold/10 text-2xl shadow-inner">
            🔒
          </div>

          <h2 className="font-display text-xl md:text-2xl font-black text-ink mb-3">
            ورود به حساب کاربری الزامی است
          </h2>

          <p className="text-xs md:text-sm text-ink-muted leading-relaxed mb-8 max-w-md mx-auto">
            {description || `برای استفاده از ابزار «${toolName}» و دسترسی به پردازش هوش مصنوعی، لطفاً وارد حساب خود شوید یا ثبت‌نام کنید.`}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto rounded-xl bg-gold hover:bg-gold-bright text-black font-extrabold px-8 py-3 text-xs transition-all shadow-lg shadow-gold/20"
            >
              ورود به حساب
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto rounded-xl border border-line bg-surface px-8 py-3 text-xs font-bold text-ink hover:border-gold/50 hover:text-gold-bright transition-all"
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
