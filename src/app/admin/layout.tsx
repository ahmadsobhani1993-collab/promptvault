import Link from 'next/link'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'

const items = [
  { href: '/admin', fa: 'داشبورد', en: 'Dashboard', icon: '⚡' },
  { href: '/admin/analytics', fa: 'آمار بازدید', en: 'Analytics', icon: '📊' },
  { href: '/admin/prompts', fa: 'پرامپت‌ها', en: 'Prompts', icon: '✨' },
  { href: '/admin/articles', fa: 'مقالات', en: 'Articles', icon: '📝' },
  { href: '/admin/categories', fa: 'دسته‌بندی‌ها', en: 'Categories', icon: '📁' },
  { href: '/admin/comments', fa: 'کامنت‌ها', en: 'Comments', icon: '💬' },
  { href: '/admin/users', fa: 'کاربران', en: 'Users', icon: '👥' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/')
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  return (
    <div className="container-app py-8">
      <div className="mb-8 rounded-2xl border border-line bg-surface/60 p-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/60 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold/15 text-sm font-bold text-gold">A</span>
            <h1 className="font-display text-base font-bold text-ink">
              {locale === 'fa' ? 'مدیریت پرامپت‌یار' : 'PromptVault Admin'}
            </h1>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-gold"
          >
            <span>←</span>
            <span>{locale === 'fa' ? 'بازگشت به سایت' : 'Back to site'}</span>
          </Link>
        </div>

        <nav className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1 md:flex-wrap">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-line/80 bg-base/50 px-3.5 py-2 text-xs font-medium text-ink-muted transition-all hover:border-gold/50 hover:bg-gold/10 hover:text-gold"
            >
              <span>{i.icon}</span>
              <span>{locale === 'fa' ? i.fa : i.en}</span>
            </Link>
          ))}
        </nav>
      </div>

      <main>{children}</main>
    </div>
  )
}
