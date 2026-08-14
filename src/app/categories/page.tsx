import Link from 'next/link'
import { cookies } from 'next/headers'
import { dictionaries, type Locale } from '@/lib/i18n'
import { categories, L } from '@/lib/data'
import CategoryIcon from '@/components/category-icon'

export const metadata = {
  title: 'دسته‌بندی‌ها',
  description: 'دسته‌بندی پرامپت‌های هوش مصنوعی',
}

export default async function CategoriesPage() {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const t = dictionaries[locale]

  return (
    <section className="container-app py-16">
      <h1 className="text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        {t.categoriesTitle}
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-7 text-ink-muted">
        {L(
          locale,
          'هر دسته شامل زیرشاخه‌ها و پرامپت‌های مرتبط است. روی هر دسته بزن تا وارد شوی.',
          'Each category contains subcategories and related prompts. Click to enter.'
        )}
      </p>

      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={'/categories/' + cat.slug}
            className="card-cream glow-gold flex items-start gap-5 p-6 transition-transform hover:-translate-y-1"
          >
            <div className="text-[#171512]">
              <CategoryIcon name={cat.icon} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#171512]">
                {L(locale, cat.fa, cat.en)}
              </h2>
              <p className="mt-2 text-xs leading-6 text-[#6b6353]">
                {L(locale, cat.descFa, cat.descEn)}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {cat.subs.map((s) => (
                  <span key={s.slug} className="rounded-full bg-[#e7dcc4] px-2 py-0.5 text-[10px] text-[#5c5443]">
                    {L(locale, s.fa, s.en)}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
