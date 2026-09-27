import Link from 'next/link'
import { auth } from '@/auth'
import { type Locale } from '@/lib/i18n'
import { getCategories, L } from '@/lib/data'
import LocaleSwitcher from '@/components/locale-switcher'

interface DesktopHeaderProps { locale: Locale }

export default async function DesktopHeader({ locale }: DesktopHeaderProps) {
  const session = await auth()
  const categories = await getCategories()

  const tools = [
    { href: '/transcribe', label: L(locale, 'تبدیل صوت به متن', 'Speech to Text'), desc: L(locale, 'تبدیل فایل صوتی به متن', 'Convert audio to text') },
    { href: '/subtitle', label: L(locale, 'استودیو زیرنویس', 'Subtitle Studio'), desc: L(locale, 'زیرنویس خودکار ویدیو و ریلز', 'Auto subtitle for videos') },
    { href: '/audio-enhancer', label: L(locale, 'تقویت و شفاف‌ساز صدا', 'Audio Enhancer'), desc: L(locale, 'کاهش نویز و شفاف‌سازی با AI', 'AI noise reduction') },
    { href: '/tools/bg-remover', label: L(locale, 'حذف پس‌زمینه', 'Background Remover'), desc: L(locale, 'حذف خودکار پس‌زمینه تصویر', 'Auto background removal') },
    { href: '/pdf-to-word', label: L(locale, 'تبدیل PDF به ورد', 'PDF to Word'), desc: L(locale, 'استخراج متن و تصویر با OCR', 'OCR text extraction') },
  ]

  const userInitial = session?.user?.name ? session.user.name.charAt(0).toUpperCase() : 'U'

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-[#070503]/85 backdrop-blur hidden md:block">
      <div className="container-app flex h-16 items-center justify-between gap-4">
        
        {/* سمت راست: لوگو + ناوبری */}
        <div className="flex items-center gap-6">
          <Link href="/" className="font-display text-lg font-extrabold tracking-tight whitespace-nowrap">
            Prompts<span className="text-gold-bright">FA</span>
          </Link>

          <nav className="flex items-center gap-5 text-sm text-ink-muted">
            <Link href="/explore" className="transition-colors hover:text-gold-bright whitespace-nowrap">
              {L(locale, 'کاوش', 'Explore')}
            </Link>

            {/* دسته‌بندی‌ها - استایل زیبا و حرفه‌ای */}
            <div className="group relative">
              <button type="button" className="flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors hover:bg-gold/10 hover:text-gold-bright whitespace-nowrap">
                {L(locale, 'دسته‌بندی‌ها', 'Categories')}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="invisible absolute left-1/2 top-full z-50 w-[550px] -translate-x-1/2 pt-4 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
                <div className="card p-6 shadow-2xl border border-gold/10">
                  <div className="grid grid-cols-3 gap-4">
                    {categories.map((c) => (
                      <Link
                        key={c.id}
                        href={'/categories/' + c.slug}
                        className="group/cat flex flex-col items-center rounded-2xl border border-transparent bg-surface p-4 transition-all hover:-translate-y-1 hover:border-gold/40 hover:bg-gold/5 hover:shadow-lg"
                      >
                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 text-3xl transition-transform duration-300 group-hover/cat:scale-110 group-hover/cat:rotate-3">
                          {c.icon}
                        </div>
                        <div className="text-sm font-bold text-ink text-center">
                          {locale === 'fa' ? c.nameFa : c.nameEn}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Link href="/blog" className="transition-colors hover:text-gold-bright whitespace-nowrap">
              {L(locale, 'مقالات', 'Blog')}
            </Link>

            {/* ابزارها */}
            <div className="group relative">
              <button type="button" className="flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors hover:bg-gold/10 hover:text-gold-bright whitespace-nowrap">
                {L(locale, 'ابزارها', 'Tools')}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="invisible absolute right-0 top-full z-50 w-80 pt-4 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
                <div className="card overflow-hidden p-3 shadow-2xl border border-gold/10">
                  <div className="space-y-1">
                    {tools.map((tool) => (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        className="flex flex-col rounded-xl border border-transparent p-3 transition-all hover:border-gold/30 hover:bg-gold/5"
                      >
                        <div className="text-sm font-bold text-ink">{tool.label}</div>
                        <div className="mt-0.5 text-[10px] text-ink-muted">{tool.desc}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </nav>
        </div>

        {/* سمت چپ: دکمه‌ها */}
        <div className="flex items-center gap-3">
          <Link
            href="/submit"
            className="inline-flex rounded-full bg-gold-bright/15 border border-gold-bright/35 px-4 py-2 text-sm font-bold text-gold-bright transition-all hover:bg-gold-bright/25 hover:border-gold-bright whitespace-nowrap"
          >
            {L(locale, 'ارسال پرامپت', 'Submit')}
          </Link>

          <LocaleSwitcher />

          {/* نوتیفیکیشن - باز شدن به سمت داخل (چپ) برای جلوگیری از بیرون زدگی */}
          <div className="group relative">
            <button className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line/60 bg-surface/50 text-ink-muted transition-colors hover:border-gold/40 hover:text-gold-bright">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <div className="invisible absolute left-0 top-full z-50 w-80 pt-4 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
              <div className="card p-4 shadow-2xl border border-gold/10">
                <div className="mb-3 flex items-center justify-between border-b border-line pb-3">
                  <h3 className="text-sm font-bold text-ink">اعلان‌ها</h3>
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold-bright">۳ جدید</span>
                </div>
                <div className="space-y-2">
                  <div className="rounded-lg border border-line/60 bg-surface/50 p-3">
                    <div className="text-xs font-bold text-ink">خوش‌آمدگویی</div>
                    <div className="mt-1 text-[10px] text-ink-muted">به PromptsFA خوش آمدید</div>
                  </div>
                  <div className="rounded-lg border border-line/60 bg-surface/50 p-3">
                    <div className="text-xs font-bold text-ink">پرامپت جدید</div>
                    <div className="mt-1 text-[10px] text-ink-muted">پرامپت شما تایید شد</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* آواتار */}
          {session?.user ? (
            <Link
              href="/account"
              className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-gold-bright/50 bg-[#120f09] transition-all hover:border-gold-bright"
              title={session.user.name || 'پروفایل'}
            >
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
            </Link>
          ) : (
            <Link href="/login" className="flex h-9 w-9 items-center justify-center rounded-full border border-line/60 bg-surface/50 text-ink-muted transition-colors hover:border-gold/40 hover:text-gold-bright">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}