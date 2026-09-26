import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { type Locale } from '@/lib/i18n'
import { getCategories, L } from '@/lib/data'
import LocaleSwitcher from '@/components/locale-switcher'
import MobileMenu from '@/components/mobile-menu'

export default async function Header() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const session = await auth()
  const categories = await getCategories()

  const mobileLinks = [
    { href: '/explore', label: L(locale, 'کاوش', 'Explore') },
    { href: '/blog', label: L(locale, 'مقالات', 'Blog') },
    { href: '/submit', label: L(locale, 'ارسال پرامپت', 'Submit') },
  ]

  const userInitial = session?.user?.name ? session.user.name.charAt(0).toUpperCase() : 'U'

  return (
    <>
      {/* هدر موبایل */}
      <header className="sticky top-0 z-40 border-b border-line/60 bg-[#070503]/95 backdrop-blur md:hidden">
        <div className="container-app flex h-14 items-center justify-between gap-2 px-3">
          <Link href="/" className="font-display text-base font-extrabold tracking-tight whitespace-nowrap">
            Prompts<span className="text-gold-bright">FA</span>
          </Link>

          <div className="flex items-center gap-2">
            <LocaleSwitcher />

            {session?.user ? (
              <Link
                href="/account"
                className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-gold-bright/50 bg-[#120f09] shadow-[0_0_8px_rgba(212,175,55,0.2)]"
                title={session.user.name || 'پروفایل'}
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
              <Link href="/login" className="btn-primary text-[10px] px-3 py-1.5">
                {L(locale, 'ورود', 'Login')}
              </Link>
            )}

            <MobileMenu
              links={mobileLinks}
              admin={session?.user?.role === 'ADMIN'}
              isLoggedIn={!!session?.user}
            />
          </div>
        </div>
      </header>

      {/* هدر دسکتاپ */}
      <header className="sticky top-0 z-40 border-b border-line/60 bg-[#070503]/85 backdrop-blur hidden md:block">
        <div className="container-app flex h-16 items-center justify-between gap-4">
          <Link href="/" className="font-display text-lg font-extrabold tracking-tight whitespace-nowrap">
            Prompts<span className="text-gold-bright">FA</span>
          </Link>

          <nav className="flex items-center gap-6 text-sm text-ink-muted">
            <Link href="/explore" className="transition-colors hover:text-gold-bright whitespace-nowrap">
              {L(locale, 'کاوش', 'Explore')}
            </Link>

            <div className="group relative">
              <button type="button" className="transition-colors hover:text-gold-bright whitespace-nowrap">
                {L(locale, 'دسته‌بندی‌ها', 'Categories')} ▾
              </button>
              <div className="invisible absolute left-1/2 top-full z-50 w-80 -translate-x-1/2 pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
                <div className="card max-h-[70vh] overflow-auto p-4">
                  {categories.map((c) => (
                    <div key={c.id} className="mb-4 last:mb-0">
                      <Link
                        href={'/categories/' + c.slug}
                        className="block rounded-lg px-3 py-1.5 text-sm font-bold text-ink transition-colors hover:bg-elevated hover:text-gold-bright"
                      >
                        {c.icon} {L(locale, c.nameFa, c.nameEn)}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-1.5 px-3">
                        {c.subs.map((s) => (
                          <Link
                            key={s.id}
                            href={'/categories/' + c.slug + '?sub=' + s.slug}
                            className="rounded-full border border-line bg-elevated px-2.5 py-1 text-[10px] text-ink-muted transition-colors hover:border-gold/50 hover:text-gold-bright"
                          >
                            {L(locale, s.fa, s.en)}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Link href="/blog" className="transition-colors hover:text-gold-bright whitespace-nowrap">
              {L(locale, 'مقالات', 'Blog')}
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link 
              href="/submit" 
              className="inline-flex rounded-lg bg-gold-bright/15 border border-gold-bright/35 px-4 py-2 text-sm font-bold text-gold-bright transition-all hover:bg-gold-bright/25 hover:border-gold-bright whitespace-nowrap"
            >
              ✨ {L(locale, 'ارسال پرامپت', 'Submit')}
            </Link>

            <LocaleSwitcher />

            {session?.user ? (
              <div className="flex items-center gap-3">
                {session.user.role === 'ADMIN' && (
                  <Link href="/admin" className="btn-secondary text-xs px-3 py-1.5">
                    Admin
                  </Link>
                )}

                <Link
                  href="/account"
                  className="group relative flex items-center gap-2 rounded-full p-0.5 transition-all hover:scale-105"
                  title={session.user.name || 'پروفایل من'}
                >
                  <div className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-gold-bright/50 bg-[#120f09] shadow-[0_0_12px_rgba(212,175,55,0.15)] transition-all group-hover:border-gold-bright group-hover:shadow-[0_0_16px_rgba(212,175,55,0.35)]">
                    {session.user.image ? (
                      <Image
                        src={session.user.image}
                        alt={session.user.name || 'User'}
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1c160c] to-[#2c2211] font-display text-sm font-bold text-gold-bright">
                        {userInitial}
                      </div>
                    )}
                  </div>
                </Link>
              </div>
            ) : (
              <Link href="/login" className="btn-primary text-sm">
                {L(locale, 'ورود', 'Login')}
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  )
}