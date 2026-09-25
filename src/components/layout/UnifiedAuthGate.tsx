'use client'

import Link from 'next/link'

interface UnifiedAuthGateProps {
  title?: string
  description?: string
  featureName?: string
}

export default function UnifiedAuthGate({
  title = 'ورود به حساب کاربری الزامی است',
  description,
  featureName = 'این بخش',
}: UnifiedAuthGateProps) {
  const defaultDesc = `برای دسترسی به «${featureName}» و استفاده از قابلیت‌های هوش مصنوعی، لطفاً وارد حساب خود شوید یا رایگان ثبت‌نام کنید.`

  return (
    <div className="container-app py-12">
      <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-gold/30 bg-[#12100d]/90 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-gold/40 bg-gold/10 text-3xl shadow-inner">
          🔒
        </div>
        
        <h2 className="font-display text-xl md:text-2xl font-black text-ink mb-3">
          {title}
        </h2>
        
        <p className="text-xs md:text-sm text-ink-muted leading-relaxed mb-8 max-w-md mx-auto">
          {description || defaultDesc}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/login"
            className="btn-primary w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-xs shadow-lg shadow-gold/20"
          >
            ورود به حساب کاربری
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
