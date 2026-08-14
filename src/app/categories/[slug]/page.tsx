import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { type Locale } from '@/lib/i18n'
import { categories, prompts, L } from '@/lib/data'
import PromptCard from '@/components/prompt-card'
import CategoryIcon from '@/components/category-icon'

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sub?: string }>
}) {
  const { slug } = await params
  const { sub } = await searchParams
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const cat = categories.find((c) => c.slug === slug)
  if (!cat) notFound()

  let list = prompts.filter((p) => p.category === slug)
  if (sub) list = list.filter((p) => p.sub === sub)

  return (
    <section className="container-app py-16">
      <div className="flex items-center gap-5">
        <div className="glow-gold rounded-2xl bg-[#F2EAD8] p-4 text-[#171512]">
          <CategoryIcon name={cat.icon} />
        </div>
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            {L(locale, cat.fa, cat.en)}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {L(locale, cat.descFa, cat.descEn)}
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          href={'/categories/' + slug}
          className={'rounded-full border px-4 py-1.5 text-xs ' + (!sub ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted')}
        >
          {L(locale, 'همه', 'All')}
        </Link>
        {cat.subs.map((s) => (
          <Link
            key={s.slug}
            href={'/categories/' + slug + '?sub=' + s.slug}
            className={'rounded-full border px-4 py-1.5 text-xs ' + (sub === s.slug ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted')}
          >
            {L(locale, s.fa, s.en)}
          </Link>
        ))}
      </div>

      {list.length > 0 ? (
        <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
          {list.map((item) => (
            <PromptCard key={item.slug} item={item} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="card mt-10 p-10 text-center text-sm text-ink-muted">
          {L(locale, 'به‌زودی پرامپت‌های این بخش اضافه می‌شود.', 'Prompts for this section are coming soon.')}
        </div>
      )}
    </section>
  )
}
