import Link from 'next/link'
import { cookies } from 'next/headers'
import { L, type Locale } from '@/lib/data'

export default async function Footer() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  return (
    <footer className="border-t border-line/70 bg-[#0a0805]">
      <div className="container-app py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="font-display text-lg font-extrabold text-gold-bright">PromptsFA</h3>
            <p className="mt-3 text-sm text-ink-muted">
              {L(locale, 'هزاران پرامپت حرفه‌ای هوش مصنوعی به فارسی', 'Thousands of professional AI prompts in Persian')}
            </p>
          </div>
          <div>
            <h4 className="font-display text-sm font-bold text-ink">
              {L(locale, 'لینک‌های سریع', 'Quick Links')}
            </h4>
            <nav className="mt-3 flex flex-col gap-2 text-sm text-ink-muted">
              <Link href="/explore" className="transition-colors hover:text-gold-bright">
                {L(locale, 'کاوش', 'Explore')}
              </Link>
              <Link href="/categories" className="transition-colors hover:text-gold-bright">
                {L(locale, 'دسته‌بندی‌ها', 'Categories')}
              </Link>
              <Link href="/blog" className="transition-colors hover:text-gold-bright">
                {L(locale, 'وبلاگ', 'Blog')}
              </Link>
            </nav>
          </div>
          <div>
            <h4 className="font-display text-sm font-bold text-ink">
              {L(locale, 'نصب اپلیکیشن', 'Install App')}
            </h4>
            <p className="mt-3 text-sm text-ink-muted">
              {L(locale, 'برای دسترسی سریع‌تر، اپلیکیشن ما را نصب کنید', 'Install our app for faster access')}
            </p>
            <button
              onClick={() => {
                alert('📲 برای نصب:\n\n• Chrome موبایل: منوی سه‌نقطه → "Add to Home Screen"\n• Safari iOS: Share → "Add to Home Screen"\n• Chrome دسکتاپ: آیکون install در نوار آدرس')
              }}
              className="mt-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold text-black shadow-lg transition-all hover:scale-110"
              title={L(locale, 'نصب اپلیکیشن', 'Install App')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
        <div className="mt-8 border-t border-line/60 pt-6 text-center text-xs text-ink-faint">
          © {new Date().getFullYear()} PromptsFA.ir - {L(locale, 'تمامی حقوق محفوظ است', 'All rights reserved')}
        </div>
      </div>
    </footer>
  )
}
