import dynamic from 'next/dynamic'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { type Locale } from '@/lib/i18n'
import { getCategories, L } from '@/lib/data'
import LocaleSwitcher from '@/components/locale-switcher'
import CategoryIcon from '@/components/category-icon'
import LogoutButton from '@/components/logout-button'

const NotifBell = dynamic(() => import('@/components/notif-bell'), { ssr: false })
const MobileMenu = dynamic(() => import('@/components/mobile-menu'), { ssr: false })

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

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-[#070503]/85 backdrop-blur">
      <div className="container-app flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MobileMenu links={mobileLinks} admin={!!isAdmin} />
          <Link href="/" className="font-display text-lg font-extrabold tracking-tight">
            Prompts<span className="text-gold-bright">FA</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 text-sm text-ink-muted lg:flex">
          <Link href="/explore" className="transition-colors hover:text-gold-bright">{L(locale, 'کاوش', 'Explore')}</Link>

          <div className="group relative">
            <button type="button" className="transition-colors hover:text-gold-bright">
              {L(locale, 'دسته‌بندی‌ها', 'Categories')} ▾
            </button>
            <div className="invisible absolute right-0 top-full z-50 w-[26rem] pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
              <div className="card grid grid-cols-2 gap-4 p-5">
                {categories.map((c) => (
                  <div key={c.id} className="rounded-xl border border-line/60 bg-elevated/50 p-3 transition-colors hover:border-gold/40">
                    <Link href={'/categories/' + c.slug} className="flex items-center gap-2 text-sm font-bold text-ink transition-colors hover:text-gold-bright">
                      <span className="text-gold-bright [&_svg]:h-5 [&_svg]:w-5"><CategoryIcon name={c.icon} /></span>
                      {L(locale, c.nameFa, c.nameEn)}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.subs.map((s) => (
                        <Link key={s.id} href={'/categories/' + c.slug + '?sub=' + s.slug} className="rounded-full bg-[#171512] px-2 py-0.5 text-[10px] text-ink-muted transition-colors hover:text-gold-bright">
                          {L(locale, s.fa, s.en)}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Link href="/blog" className="transition-colors hover:text-gold-bright">{L(locale, 'وبلاگ', 'Blog')}</Link>
        </nav>

        <div className="flex items-center gap-2">
          <NotifBell />
          <LocaleSwitcher />
          {session?.user ? (
            <>
              {isAdmin && (
                <Link href="/admin" className="btn-secondary hidden md:inline-flex">🛠 {L(locale, 'مدیریت', 'Admin')}</Link>
              )}
              <Link href="/submit" className="btn-primary whitespace-nowrap">{L(locale, 'ارسال', 'Submit')}</Link>
              <LogoutButton label={L(locale, 'خروج', 'Logout')} />
            </>
          ) : (
            <Link href="/login" className="btn-primary">{L(locale, 'ورود', 'Login')}</Link>
          )}
        </div>
      </div>
    </header>
  )
}
