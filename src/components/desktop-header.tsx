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
    { href: '/transcribe', icon: '🎙️', label: L(locale, 'تبدیل صوت به متن', 'Speech to Text'), desc: L(locale, 'تبدیل فایل صوتی به متن', 'Convert audio to text') },
    { href: '/subtitle', icon: '', label: L(locale, 'استودیو زیرنویس', 'Subtitle Studio'), desc: L(locale, 'زیرنویس خودکار ویدیو و ریلز', 'Auto subtitle for videos') },
    { href: '/audio-enhancer', icon: '🔊', label: L(locale, 'تقویت و شفاف‌ساز صدا', 'Audio Enhancer'), desc: L(locale, 'کاهش نویز و شفاف‌سازی با AI', 'AI noise reduction') },
    { href: '/tools/bg-remover', icon: '✨', label: L(locale, 'حذف پس‌زمینه', 'Background Remover'), desc: L(locale, 'حذف خودکار پس‌زمینه تصویر', 'Auto background removal') },
    { href: '/pdf-to-word', icon: '📄', label: L(locale, 'تبدیل PDF به ورد', 'PDF to Word'), desc: L(locale, 'استخراج متن و تصویر با OCR', 'OCR text extraction') },
  ]

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
          </nav>
        </div>

        {/* سمت چپ: دکمه‌ها */}
        <div className="flex items-center gap-3">
          {/* دکمه ابزارها با dropdown */}
          <div className="group relative">
            <button type="button" className="flex items-center gap-1.5 rounded-lg bg-gold-bright/15 border border-gold-bright/35 px-3 py-2 text-sm font-bold text-gold-bright transition-all hover:bg-gold-bright/25">
              <span>⚡</span>
              <span>{L(locale, 'ابزارها', 'Tools')}</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="invisible absolute left-0 top-full z-50 w-72 pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
              <div className="card overflow-hidden p-2 shadow-2xl">
                {tools.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-elevated"
                  >
                    <span className="text-2xl">{tool.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-ink">{tool.label}</div>
                      <div className="text-[10px] text-ink-muted">{tool.desc}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <LocaleSwitcher />

          {/* آواتار */}
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
        </div>
      </div>
    </header>
  )
}
