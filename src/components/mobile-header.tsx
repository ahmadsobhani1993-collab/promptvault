'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type Locale } from '@/lib/i18n'
import { L } from '@/lib/data'
import LocaleSwitcher from '@/components/locale-switcher'
import MobileMenu from '@/components/mobile-menu'

interface NotificationItem {
  id: string
  text: string
  url: string
  createdAt: Date
}

interface MobileHeaderProps {
  locale: Locale
  session?: any
  notifications?: NotificationItem[]
}

export default function MobileHeader({ locale, session, notifications = [] }: MobileHeaderProps) {
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const router = useRouter()
  const userInitial = session?.user?.name ? session.user.name.charAt(0).toUpperCase() : 'U'

  const handleLoginClick = (e: React.MouseEvent) => {
    e.preventDefault()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-[#070503]/95 backdrop-blur md:hidden">
      <div className="container-app flex h-14 items-center justify-between gap-2 px-3">
        
        {/* راست: همبرگری + لوگو */}
        <div className="flex items-center gap-2">
          <MobileMenu
            links={[
              { href: '/explore', label: L(locale, 'کاوش', 'Explore') },
              { href: '/categories', label: L(locale, 'دسته‌بندی‌ها', 'Categories') },
              { href: '/blog', label: L(locale, 'مقالات', 'Blog') },
              { href: '/tools', label: L(locale, 'ابزارها', 'Tools') },
              { href: '/submit', label: L(locale, 'ارسال پرامپت', 'Submit') },
            ]}
            admin={session?.user?.role === 'ADMIN'}
            isLoggedIn={!!session?.user}
          />

          <Link href="/" className="font-display text-base font-extrabold tracking-tight whitespace-nowrap">
            Prompts<span className="text-gold-bright">FA</span>
          </Link>
        </div>

        {/* چپ: سوئیچ زبان + اعلان + پروفایل */}
        <div className="flex items-center gap-2">
          <LocaleSwitcher />

          {/* نوتیفیکیشن با کنترل کلیک لمسی */}
          <div className="relative">
            <button 
              type="button"
              onClick={() => setIsNotifOpen((prev) => !prev)}
              aria-label={L(locale, 'اعلان‌ها', 'Notifications')}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line/60 bg-surface/50 text-ink-muted transition-colors hover:border-gold/40 hover:text-gold-bright"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>

            {isNotifOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsNotifOpen(false)} 
                />
                
                <div className="absolute left-0 top-full z-50 mt-2 w-72">
                  <div className="card p-4 shadow-2xl max-h-[400px] overflow-y-auto border border-gold/20 bg-[#0f0c08]">
                    <div className="mb-3 flex items-center justify-between border-b border-line pb-3">
                      <h3 className="text-sm font-bold text-ink">اعلان‌ها</h3>
                      <Link 
                        href="/notifications" 
                        onClick={() => setIsNotifOpen(false)}
                        className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold-bright hover:bg-gold/30"
                      >
                        مشاهده همه
                      </Link>
                    </div>

                    {notifications.length === 0 ? (
                      <p className="text-center text-ink-muted py-6 text-xs">هنوز نوتیفی نداری</p>
                    ) : (
                      <div className="space-y-2">
                        {notifications.map((n) => (
                          <Link 
                            key={n.id} 
                            href={n.url || '/notifications'} 
                            onClick={() => setIsNotifOpen(false)}
                            className="block rounded-lg border border-line/60 bg-surface/50 p-3 transition-colors hover:bg-gold/5 hover:border-gold/30"
                          >
                            <div className="text-xs font-bold text-ink">{n.text}</div>
                            <div className="mt-1 text-[10px] text-ink-muted">
                              {new Date(n.createdAt).toLocaleDateString('fa-IR')}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* لاگین / اکانت */}
          {session?.user ? (
            <Link
              href="/account"
              aria-label={session.user.name || 'حساب کاربری'}
              className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-gold-bright/60 bg-[#120f09] active:scale-95 transition-transform"
              title="پروفایل"
            >
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1c160c] to-[#2c2211] font-display text-xs font-bold text-gold-bright">
                  {userInitial}
                </div>
              )}
            </Link>
          ) : (
            <button 
              type="button"
              onClick={handleLoginClick}
              aria-label={L(locale, 'ورود به حساب کاربری', 'Login to account')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold-bright active:scale-95 hover:bg-gold/20 transition-all cursor-pointer"
              title="ورود"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
