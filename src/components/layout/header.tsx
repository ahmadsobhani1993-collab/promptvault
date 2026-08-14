import Link from 'next/link'
import { auth, signOut } from '@/auth'
import { dictionaries, type Locale } from '@/lib/i18n'
import { getCategories, L } from '@/lib/data'
import { LanguageToggle } from '@/components/locale-provider'
import CategoryIcon from '@/components/category-icon'

export default async function Header({ locale }: { locale: Locale }) {
  const t = dictionaries[locale]
  const session = await auth()
  const categories = await getCategories()

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-base/80 backdrop-blur-md">
      <div className="container-app flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-display text-lg font-extrabold tracking-tight">
            Prompts<span className="text-gold-bright">FA</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/explore" className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
              {t.nav.explore}
            </Link>
            <Link href="/prompts" className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
              {t.nav.prompts}
            </Link>

            <div className="group relative">
              <Link href="/categories" className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
                {t.nav.categories}
              </Link>

              <div className="absolute end-0 top-full z-50 hidden w-80 pt-3 group-hover:block">
                <div className="card grid grid-cols-2 gap-2 p-3">
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      href={'/categories/' + c.slug}
                      className="rounded-xl border border-line bg-elevated p-3 transition-colors hover:border-gold/50 hover:bg-surface-hover"
                    >
                      <div className="text-gold-bright [&_svg]:h-5 [&_svg]:w-5">
                        <CategoryIcon name={c.icon} />
                      </div>
                      <p className="mt-2 text-xs font-bold text-ink">
                        {L(locale, c.nameFa, c.nameEn)}
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-ink-faint">
                        {c.subs.map((s) => L(locale, s.fa, s.en)).join('، ')}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <Link href="/creators" className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
              {t.nav.creators}
            </Link>
            <Link href="/blog" className="text-sm text-ink-muted transition-colors hover:text-gold-bright">
              {t.nav.blog}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {session?.user?.role === 'ADMIN' && (
            <Link href="/admin" className="btn-secondary hidden md:inline-flex">
              {locale === 'fa' ? 'مدیریت' : 'Admin'}
            </Link>
          )}

          <Link href="/submit" className="btn-secondary hidden md:inline-flex">
            {t.submit}
          </Link>

          <LanguageToggle locale={locale} label={t.langToggle} />

          {session?.user ? (
            <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }) }}>
              <button type="submit" className="btn-secondary">{t.logout}</button>
            </form>
          ) : (
            <Link href="/login" className="btn-primary">{t.login}</Link>
          )}
        </div>
      </div>
    </header>
  )
}
