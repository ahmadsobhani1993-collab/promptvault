import Link from 'next/link'
import { auth } from '@/auth'
import { type Locale } from '@/lib/i18n'
import { L } from '@/lib/data'
import LocaleSwitcher from '@/components/locale-switcher'
import MobileMenu from '@/components/mobile-menu'

interface MobileHeaderProps { locale: Locale }

export default async function MobileHeader({ locale }: MobileHeaderProps) {
  const session = await auth()

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-[#070503]/95 backdrop-blur md:hidden">
      <div className="container-app flex h-14 items-center justify-between gap-2 px-3">
        {/* لوگو */}
        <Link href="/" className="font-display text-base font-extrabold tracking-tight whitespace-nowrap">
          Prompts<span className="text-gold-bright">FA</span>
        </Link>

        {/* آیتم‌های سمت چپ */}
        <div className="flex items-center gap-2">
          <LocaleSwitcher />

          {session?.user ? (
            <Link
              href="/account"
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line/60 bg-surface/50 text-ink-muted transition-colors hover:border-gold/40 hover:text-gold-bright"
              title="پروفایل"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
          ) : (
            <Link href="/login" className="flex h-9 w-9 items-center justify-center rounded-full border border-line/60 bg-surface/50 text-ink-muted transition-colors hover:border-gold/40 hover:text-gold-bright">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
          )}

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
        </div>
      </div>
    </header>
  )
}
