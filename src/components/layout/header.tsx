import Link from 'next/link'
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
      {/* ================= هدر موبایل ================= */}
      <header className="sticky top-0 z-40 border-b border-line/60 bg-[#070503]/95 backdrop-blur md:hidden">
        <div className="container-app flex h-14 items-center justify-between gap-2 px-3">
          {/* لوگو */}
          <Link href="/" className="font-display text-base font-extrabold tracking-tight whitespace-nowrap">
            Prompts<span className="text-gold-bright">FA</span>
          </Link>

          {/* آیتم‌های سمت چپ موبایل */}
          <div className="flex items-center gap-1.5">
            {/*  ابزار - نسخه موبایل (فقط آیکون) */}
            <div className="hidden sm:flex items-center gap-1">
              <Link href="/transcribe" className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-xs text-ink-muted transition-colors hover:bg-gold/10 hover:text-gold-bright" title="تبدیل صدا به متن">
                🎙️
              </Link>
              <Link href="/subtitle" className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-xs text-ink-muted transition-colors hover:bg-gold/10 hover:text-gold-bright" title="استودیو زیرنویس">
                🎬
              </Link>
              <Link href="/audio-enhancer" className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-xs text-ink-muted transition-colors hover:bg-gold/10 hover:text-gold-bright" title="تقویت صدا">
                🔊
              </Link>
              <Link href="/tools/bg-remover" className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-xs text-ink-muted transition-colors hover:bg-gold/10 hover:text-gold-bright" title="حذف پس‌زمینه">
                ✂️
              </Link>
              <Link href="/pdf-to-word" className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-xs text-ink-muted transition-colors hover:bg-gold/10 hover:text-gold-bright" title="PDF به Word">
                📄
              </Link>
            </div>

            <LocaleSwitcher />

            {session?.user ? (
              <Link
                href="/account"
                className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 border-gold-bright/50 bg-[#120f09] shadow-[0_0_8px_rgba(212,175,55,0.2)]"
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

      {/* ================= هدر دسکتاپ ================= */}
      <header className="sticky top-0 z-40 border-b border-line/60 bg-[#070503]/85 backdrop-blur hidden md:block">
        <div className="container-app flex h-16 items-center justify-between gap-4">
          <Link href="/" className="font-display text-lg font-extrabold tracking-tight whitespace-nowrap">
            Prompts<span className="text-gold-bright">FA</span>
          </Link>

          {/* ۵ ابزار - نسخه دسکتاپ (آیکون + متن) */}
          <nav className="flex items-center gap-2">
            <Link href="/transcribe" className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-xs font-bold text-ink-muted transition-all hover:bg-gold/10 hover:text-gold-bright">
              <span>🎙️</span>
              <span>{L(locale, 'تبدیل صدا', 'Transcribe')}</span>
            </Link>
            <Link href="/subtitle" className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-xs font-bold text-ink-muted transition-all hover:bg-gold/10 hover:text-gold-bright">
              <span>🎬</span>
              <span>{L(locale, 'زیرنویس', 'Subtitle')}</span>
            </Link>
            <Link href="/audio-enhancer" className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-xs font-bold text-ink-muted transition-all hover:bg-gold/10 hover:text-gold-bright">
              <span>🔊</span>
              <span>{L(locale, 'تقویت صدا', 'Audio')}</span>
            </Link>
            <Link href="/tools/bg-remover" className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-xs font-bold text-ink-muted transition-all hover:bg-gold/10 hover:text-gold-bright">
              <span>✂️</span>
              <span>{L(locale, 'حذف پس‌زمینه', 'BG Remover')}</span>
            </Link>
            <Link href="/pdf-to-word" className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-xs font-bold text-ink-muted transition-all hover:bg-gold/10 hover:text-gold-bright">
              <span>📄</span>
              <span>{L(locale, 'PDF به Word', 'PDF to Word')}</span>
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link 
              href="/submit" 
              className="inline-flex rounded-lg bg-gold-bright/15 border border-gold-bright/35 px-4 py-2 text-sm font-bold text-gold-bright transition-all hover:bg-gold-bright/25 hover:border-gold-bright whitespace-nowrap"
            >
               {L(locale, 'ارسال پرامپت', 'Submit')}
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
                      <img
                        src={session.user.image}
                        alt={session.user.name || 'User'}
                        className="h-full w-full object-cover"
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