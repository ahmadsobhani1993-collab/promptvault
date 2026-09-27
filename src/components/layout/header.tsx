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

  const tools = [
    {
      href: '/transcribe',
      label: L(locale, 'تبدیل صوت به متن', 'Speech to Text'),
      desc: L(locale, 'تبدیل فایل صوتی به متن', 'Convert audio to text'),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
      ),
    },
    {
      href: '/subtitle',
      label: L(locale, 'استودیو زیرنویس', 'Subtitle Studio'),
      desc: L(locale, 'زیرنویس خودکار ویدیو و ریلز', 'Auto subtitle for videos'),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
      ),
    },
    {
      href: '/audio-enhancer',
      label: L(locale, 'تقویت و شفاف‌ساز صدا', 'Audio Enhancer'),
      desc: L(locale, 'کاهش نویز و شفاف‌سازی با AI', 'AI noise reduction'),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.5a.75.75 0 01-.75-.75v-6a.75.75 0 01.75-.75h2.25z" />
        </svg>
      ),
    },
    {
      href: '/tools/bg-remover',
      label: L(locale, 'حذف پس‌زمینه', 'Background Remover'),
      desc: L(locale, 'حذف خودکار پس‌زمینه تصویر', 'Auto background removal'),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
        </svg>
      ),
    },
    {
      href: '/pdf-to-word',
      label: L(locale, 'تبدیل PDF به ورد', 'PDF to Word'),
      desc: L(locale, 'استخراج متن و تصویر با OCR', 'OCR text extraction'),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
  ]

  const AVATAR_ICON = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )

  return (
    <header className="sticky top-0 z-40 bg-[#070503]/95 backdrop-blur px-3 pt-3 md:px-4">
      <div className="container-app flex h-14 md:h-16 items-center justify-between gap-2 md:gap-4 rounded-2xl border border-gold/40 bg-[#0c0c0c] px-4 md:px-5">

        {/* ===== سمت راست: منوی موبایل + لوگو + ناوبری دسکتاپ ===== */}
        <div className="flex items-center gap-3 md:gap-6">
          {/* منوی موبایل - فقط موبایل، کنار لوگو سمت راست */}
          <div className="md:hidden">
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

          {/* لوگو */}
          <Link href="/" dir="ltr" className="font-display text-base md:text-lg font-extrabold tracking-tight whitespace-nowrap">
            Prompts<span className="text-gold-bright">FA</span>
          </Link>

          {/* ناوبری دسکتاپ (مخفی در موبایل) */}
          <nav className="hidden md:flex items-center gap-5 text-sm text-ink-muted">
            <Link href="/explore" className="transition-colors hover:text-gold-bright whitespace-nowrap">
              {L(locale, 'کاوش', 'Explore')}
            </Link>

            {/* دسته‌بندی‌ها با کارت‌های کوچک */}
            <div className="group relative">
              <button type="button" className="flex items-center gap-1 transition-colors hover:text-gold-bright whitespace-nowrap">
                {L(locale, 'دسته‌بندی‌ها', 'Categories')}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="invisible absolute right-0 top-full z-50 pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
                <div className="card p-4 shadow-2xl">
                  <div className="grid grid-cols-6 gap-2">
                    {categories.map((c) => (
                      <Link
                        key={c.id}
                        href={'/categories/' + c.slug}
                        className="flex flex-col items-center justify-center rounded-xl border border-gold/30 bg-cream/90 p-2 transition-all hover:border-gold hover:shadow-md hover:shadow-gold/20"
                      >
                        <span className="text-xl mb-1">{c.icon}</span>
                        <span className="text-[10px] font-bold text-ink text-center leading-tight">
                          {locale === 'fa' ? c.nameFa : c.nameEn}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Link href="/blog" className="transition-colors hover:text-gold-bright whitespace-nowrap">
              {L(locale, 'مقالات', 'Blog')}
            </Link>

            {/* ابزارها با dropdown */}
            <div className="group relative">
              <button type="button" className="flex items-center gap-1 transition-colors hover:text-gold-bright whitespace-nowrap">
                {L(locale, 'ابزارها', 'Tools')}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="invisible absolute right-0 top-full z-50 w-72 pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
                <div className="card overflow-hidden p-2 shadow-2xl">
                  {tools.map((tool) => (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-elevated"
                    >
                      <span className="text-gold-bright">{tool.icon}</span>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-ink">{tool.label}</div>
                        <div className="text-[10px] text-ink-muted">{tool.desc}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </nav>
        </div>

        {/* ===== سمت چپ: دکمه‌ها و آواتار ===== */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* دکمه ارسال پرامپت - فقط دسکتاپ، توپر و طلایی */}
          <Link
            href="/submit"
            className="hidden md:inline-flex rounded-lg bg-gold-bright px-4 py-1.5 text-sm font-bold text-[#1a1400] transition-opacity hover:opacity-90 whitespace-nowrap"
          >
            {L(locale, 'ارسال پرامپت', 'Submit')}
          </Link>

          {/* سوییچر زبان */}
          <LocaleSwitcher />

          {/* آیکون نوتیفیکیشن - خنثی */}
          <button className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line/60 bg-surface/50 text-ink-muted transition-colors hover:border-gold/40 hover:text-gold-bright">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>

          {/* آواتار کاربر - حلقه‌ی طلایی برای تمایز از نوتیف */}
          {session?.user ? (
            <Link
              href="/account"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-bright/60 bg-gold-bright/10 text-gold-bright transition-colors hover:bg-gold-bright/20"
              title={session.user.name || 'پروفایل'}
            >
              {AVATAR_ICON}
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-bright/60 bg-gold-bright/10 text-gold-bright transition-colors hover:bg-gold-bright/20"
            >
              {AVATAR_ICON}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
