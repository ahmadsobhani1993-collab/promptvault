import Link from 'next/link'
import { auth } from '@/auth'
import { cookies } from 'next/headers'
import { L, getCategories } from '@/lib/data'
import { type Locale } from '@/lib/i18n'
import MobileMenu from '@/components/mobile-menu'
import NotifBell from '@/components/notif-bell'

export default async function Header() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const session = await auth()
  const categories = await getCategories()
  const isAdmin = session?.user?.role === 'ADMIN'

  const mobileLinks = [
    { href: '/explore', label: L(locale, 'کاوش', 'Explore') },
    { href: '/prompts', label: L(locale, 'پرامپت‌ها', 'Prompts') },
    { href: '/categories', label: L(locale, 'دسته‌بندی‌ها', 'Categories') },
    { href: '/blog', label: L(locale, 'وبلاگ', 'Blog') },
    { href: '/submit', label: L(locale, 'ارسال پرامپت', 'Submit') },
  ]

  if (session?.user) {
    mobileLinks.push({ href: '/account', label: L(locale, 'حساب', 'Account') })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-[#070503]/85 backdrop-blur">
      <div className="container-app flex h-16 items-center justify-between gap-4">
        
        {/* Logo & Mobile Menu */}
        <div className="flex items-center gap-3">
          <MobileMenu links={mobileLinks} admin={!!isAdmin} isLoggedIn={!!session?.user} />
          <Link href="/" className="font-display text-lg font-extrabold tracking-tight whitespace-nowrap">
            Prompts<span className="text-gold-bright">FA</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 text-sm text-ink-muted lg:flex">
          <Link href="/explore" className="transition-colors hover:text-gold-bright whitespace-nowrap">
            {L(locale, 'کاوش', 'Explore')}
          </Link>

          <div className="group relative">
            <button type="button" className="transition-colors hover:text-gold-bright whitespace-nowrap">
              {L(locale, 'دسته‌بندی‌ها', 'Categories')} ▾
            </button>
            <div className="invisible absolute right-0 top-full z-50 w-[26rem] pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
              <div className="card grid grid-cols-2 gap-4 p-5">
                {categories.map((c) => (
                  <div key={c.id} className="rounded-xl border border-line/60 bg-elevated/50 p-3 transition-colors hover:border-gold/40">
                    <Link href={'/categories/' + c.slug} className="flex items-center gap-2 text-sm font-bold text-ink transition-colors hover:text-gold-bright">
                      <span className="text-gold-bright [&_svg]:h-5 [&_svg]:w-5">
                        <CategoryIcon name={c.icon} />
                      </span>
                      {L(locale, c.nameFa, c.nameEn)}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Link href="/blog" className="transition-colors hover:text-gold-bright whitespace-nowrap">
            {L(locale, 'وبلاگ', 'Blog')}
          </Link>
        </nav>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          
          {/* Language Switcher */}
          <div className="hidden md:flex">
            <Link href="/?locale=fa" className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${locale === 'fa' ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted hover:border-gold/40'}`}>
              فارسی
            </Link>
            <Link href="/?locale=en" className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${locale === 'en' ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted hover:border-gold/40'}`}>
              English
            </Link>
          </div>
          
          <NotifBell />
          
          {/* Account / Login */}
          {session?.user ? (
            <Link href="/account" className="btn-secondary hidden md:inline-flex">
              👤 {L(locale, 'حساب', 'Account')}
            </Link>
          ) : (
            <Link href="/login" className="btn-secondary hidden md:inline-flex">
              {L(locale, 'ورود', 'Login')}
            </Link>
          )}

          {/* Submit Prompt Button - Always visible on desktop */}
          <Link href="/submit" className="btn-primary hidden md:inline-flex text-xs whitespace-nowrap">
            ✨ {L(locale, 'ارسال پرامپت', 'Submit')}
          </Link>

          {/* Logout Button - Only if logged in */}
          {session?.user && (
            <Link href="/api/auth/signout" className="btn-secondary hidden lg:inline-flex text-xs">
              {L(locale, 'خروج', 'Logout')}
            </Link>
          )}
          
        </div>
      </div>
    </header>
  )
}

function CategoryIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    image: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
    code: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
    music: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
    video: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
    writing: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    productivity: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"/></svg>,
  }
  return icons[name] || icons.image
}
