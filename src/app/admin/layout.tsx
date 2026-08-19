import Link from 'next/link'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'

const items = [
  { href: '/admin', fa: 'داشبورد', en: 'Dashboard' },
  { href: '/admin/analytics', fa: 'آمار بازدید', en: 'Analytics' },
    { href: '/admin/prompts', fa: 'پرامپت‌ها', en: 'Prompts' },
  { href: '/admin/articles', fa: 'مقالات', en: 'Articles' },
  { href: '/admin/categories', fa: 'دسته‌بندی‌ها', en: 'Categories' },
  { href: '/admin/comments', fa: 'کامنت‌ها', en: 'Comments' },
  { href: '/admin/users', fa: 'کاربرها و ادمین‌ها', en: 'Users & Admins' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/')
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  return (
    <div className="container-app flex flex-col gap-6 py-10">
      <aside className="w-full shrink-0">
        <p className="gold-badge mb-4">Admin</p>
        <nav className="flex flex-row flex-wrap gap-2">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="rounded-xl border border-line bg-elevated px-3 py-2 text-xs text-ink-muted transition-colors hover:border-gold/50 hover:text-gold-bright"
            >
              {locale === 'fa' ? i.fa : i.en}
            </Link>
          ))}
          <Link href="/" className="mt-4 text-xs text-ink-faint hover:text-gold-bright">
            {locale === 'fa' ? '← بازگشت به سایت' : '← Back to site'}
          </Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
