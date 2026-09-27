import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { type Locale } from '@/lib/i18n'
import { getCategories, L } from '@/lib/data'
import LocaleSwitcher from '@/components/locale-switcher'

// کامپوننت آیکون دسته‌بندی
function CategoryIcon({ name, className = "w-8 h-8" }: { name: string; className?: string }) {
  const icons: Record<string, JSX.Element> = {
    file: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    play: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
      </svg>
    ),
    camera: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
      </svg>
    ),
    gear: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    music: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
      </svg>
    ),
    code: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  }

  return icons[name] || icons.file
}

interface DesktopHeaderProps { locale: Locale }

export default async function DesktopHeader({ locale }: DesktopHeaderProps) {
  const session = await auth()
  const categories = await getCategories()
  
  // دریافت نوتیفیکیشن‌های کاربر
  let notifications: Array<{ id: string; text: string; url: string; createdAt: Date }> = []
  if (session?.user?.id) {
    const notifs = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    notifications = notifs
  }

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

            {/* دسته‌بندی‌ها با آیکون SVG */}
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
                          <CategoryIcon name={c.icon} className="w-8 h-8 text-gold-bright" />
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

          {/* نوتیفیکیشن - با لینک به /notifications */}
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
                  <Link href="/notifications" className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold-bright hover:bg-gold/30">
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