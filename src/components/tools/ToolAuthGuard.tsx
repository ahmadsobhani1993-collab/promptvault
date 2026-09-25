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
  toolName = 'این ابزار هوشمند',
  description,
}: ToolAuthGuardProps) {
  const auth = useAuth()

  if (auth === 'checking') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (auth === 'no') {
    return (
      <div className="relative min-h-[75vh] w-full flex items-center justify-center p-4 overflow-hidden" dir="rtl">
        {/* کادر پس‌زمینه نیمه‌محو ابزار */}
        <div className="absolute inset-0 opacity-15 pointer-events-none filter blur-sm select-none">
          {children}
        </div>

        {/* کارت ورود شیک مطابق دیزاین اختصاصی */}
        <div className="relative z-20 w-full max-w-lg overflow-hidden rounded-3xl border border-amber-500/25 bg-[#12100d]/95 p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-3xl shadow-inner">
            ✨
          </div>

          <h2 className="font-display text-2xl font-black text-white mb-2">
            ورود یا عضویت برای استفاده از {toolName}
          </h2>

          <p className="text-xs md:text-sm text-stone-400 leading-relaxed mb-8 max-w-md mx-auto">
            {description || `برای دسترسی به قابلیت‌های پردازش نامحدود «${toolName}»، لطفاً وارد حساب خود شوید.`}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black px-8 py-3 text-xs transition-all shadow-lg shadow-amber-500/20 active:scale-95"
            >
              ورود سریع با تلگرام / گوگل
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto rounded-xl border border-white/10 bg-zinc-900/80 px-8 py-3 text-xs font-bold text-stone-300 hover:border-amber-500/40 hover:text-white transition-all"
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
