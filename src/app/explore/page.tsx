import Link from 'next/link'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { prompts, typeLabel, L, type PromptType } from '@/lib/data'
import PromptCard from '@/components/prompt-card'

export const metadata = {
  title: 'کاوش',
  description: 'جستجو و فیلتر پرامپت‌های هوش مصنوعی',
}

const types: (PromptType | 'all')[] = ['all', 'image', 'video', 'text', 'code', 'audio']

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>
}) {
  const params = await searchParams
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  let list = prompts
  if (params.type && params.type !== 'all') {
    list = list.filter((p) => p.type === params.type)
  }
  if (params.q) {
    const q = params.q.toLowerCase()
    list = list.filter(
      (p) =>
        p.titleFa.includes(q) ||
        p.titleEn.toLowerCase().includes(q) ||
        p.tagsFa.some((t) => t.includes(q)) ||
        p.tagsEn.some((t) => t.toLowerCase().includes(q))
    )
  }

  return (
    <section className="container-app py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {L(locale, 'کاوش', 'Explore')}
      </h1>

      <form action="/explore" className="mt-6 max-w-2xl">
        <input
          name="q"
          defaultValue={params.q ?? ''}
          placeholder={L(locale, 'جستجو در پرامپت‌ها و تگ‌ها...', 'Search prompts and tags...')}
          className="input text-base"
        />
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        {types.map((tp) => (
          <Link
            key={tp}
            href={tp === 'all' ? '/explore' : '/explore?type=' + tp}
            className={'rounded-full border px-4 py-1.5 text-xs ' + ((params.type ?? 'all') === tp ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted')}
          >
            {tp === 'all'
              ? L(locale, 'همه', 'All')
              : L(locale, typeLabel[tp].fa, typeLabel[tp].en)}
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
          {L(locale, 'نتیجه‌ای پیدا نشد.', 'No results found.')}
        </div>
      )}
    </section>
  )
}
