import Link from 'next/link'
import { cookies } from 'next/headers'
import { L, type Locale } from '@/lib/data'
import PWAInstallButton from '@/components/pwa-install-button'

export default async function Footer() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  return (
    <footer className="border-t border-line/70 bg-[#0a0805] text-ink">
      <div className="container-app py-12">
        <div className="grid gap-10 md:grid-cols-4">
          
          {/* ستون اول: برند و فینسوف */}
          <div className="space-y-4">
            <h3 className="font-display text-xl font-extrabold text-gold-bright tracking-wide">PromptsFA</h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              {L(locale, 'هزاران پرامپت حرفه‌ای هوش مصنوعی به فارسی و انگلیسی همراه با ابزارهای تولید محتوا.', 'Thousands of professional AI prompts in Persian and English with creative workflows.')}
            </p>
            <div className="pt-2">
              <a
                href="https://finsoph.ir"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/5 px-3 py-2 text-xs font-medium text-gold transition-colors hover:border-gold hover:bg-gold/15"
              >
                <span>🌐 {L(locale, 'به وبسایت فینسوف هم سر بزنید', 'Visit Finsoph Website')}</span>
                <span className="text-[10px] opacity-70">finsoph.ir</span>
              </a>
            </div>
          </div>

          {/* ستون دوم: لینک‌های سریع */}
          <div>
            <h4 className="font-display text-sm font-bold text-ink">
              {L(locale, 'لینک‌های سریع', 'Quick Links')}
            </h4>
            <nav className="mt-4 flex flex-col gap-2.5 text-sm text-ink-muted">
              <Link href="/explore" className="transition-colors hover:text-gold-bright">
                {L(locale, 'کاوش پرامپت‌ها', 'Explore')}
              </Link>
              <Link href="/categories" className="transition-colors hover:text-gold-bright">
                {L(locale, 'دسته‌بندی‌ها', 'Categories')}
              </Link>
              <Link href="/blog" className="transition-colors hover:text-gold-bright">
                {L(locale, 'وبلاگ و آموزش', 'Blog')}
              </Link>
              <Link href="/subtitle" className="transition-colors hover:text-gold-bright">
                {L(locale, 'استودیو زیرنویس', 'Subtitle Studio')}
              </Link>
            </nav>
          </div>

          {/* ستون سوم: شبکه‌های اجتماعی */}
          <div>
            <h4 className="font-display text-sm font-bold text-ink">
              {L(locale, 'ارتباط با ما', 'Community')}
            </h4>
            <div className="mt-4 flex flex-col gap-2.5 text-sm">
              <a
                href="https://t.me/prompts_fa"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-ink-muted transition-colors hover:text-gold-bright"
              >
                <span className="text-gold">✈️</span>
                <span>{L(locale, 'کانال تلگرام', 'Telegram')}: <span dir="ltr" className="font-mono text-xs text-gold">@prompts_fa</span></span>
              </a>
              <a
                href="https://instagram.com/prompts_fa"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-ink-muted transition-colors hover:text-gold-bright"
              >
                <span className="text-gold">📸</span>
                <span>{L(locale, 'اینستاگرام', 'Instagram')}: <span dir="ltr" className="font-mono text-xs text-gold">@prompts_fa</span></span>
              </a>
            </div>
          </div>

          {/* ستون چهارم: نصب اپلیکیشن */}
          <div>
            <h4 className="font-display text-sm font-bold text-ink">
              {L(locale, 'نصب اپلیکیشن', 'Install App')}
            </h4>
            <p className="mt-4 text-sm text-ink-muted leading-relaxed">
              {L(locale, 'برای دسترسی سریع‌تر و تجربه کاربری روان‌تر، اپلیکیشن را نصب کنید.', 'Install the web app for faster access and optimized experience.')}
            </p>
            <div className="mt-4">
              <PWAInstallButton />
            </div>
          </div>

        </div>

        {/* کپی‌رایت پایین */}
        <div className="mt-10 border-t border-line/50 pt-6 text-center text-xs text-ink-muted/80">
          <p>© {new Date().getFullYear()} PromptsFA. {L(locale, 'تمامی حقوق محفوظ است.', 'All rights reserved.')}</p>
        </div>
      </div>
    </footer>
  )
}
