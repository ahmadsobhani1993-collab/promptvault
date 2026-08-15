import Link from 'next/link'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { getPrompts, promptTypes, L } from '@/lib/data'
import { TAG_VOCAB } from '@/lib/gemini'
import { prisma } from '@/lib/db'
import PromptCard from '@/components/prompt-card'
import TagFilter from '@/components/tag-filter'

export const metadata = { title: 'کاوش', description: 'جستجو و فیلتر پرامپت‌ها' }
export const dynamic = 'force-dynamic'

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; tags?: string }>
}) {
  const params = await searchParams
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const selectedTags = (params.tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 2)

  const prompts = await getPrompts({ type: params.type, q: params.q, tags: selectedTags })

  const allTagsRows = await prisma.prompt.findMany({
    where: { status: 'PUBLISHED' },
    select: { tagsFa: true },
  })
  const freq: Record<string, number> = {}
  for (const r of allTagsRows) for (const t of r.tagsFa) freq[t] = (freq[t] ?? 0) + 1
  const top = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map((e) => e[0])

  return (
    <section className="container-app py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {L(locale, 'کاوش', 'Explore')}
      </h1>

      <form action="/explore" className="mt-6 max-w-2xl">
        <input
          name="q"
          defaultValue={params.q ?? ''}
          placeholder={L(locale, 'جستجو در پرامپت‌ها...', 'Search prompts...')}
          className="input text-base"
        />
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/explore"
          className={'rounded-full border px-4 py-1.5 text-xs ' + (!params.type ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted')}
        >
          {L(locale, 'همه', 'All')}
        </Link>
        {promptTypes.map((tp) => (
          <Link
            key={tp.value}
            href={'/explore?type=' + tp.value}
            className={'rounded-full border px-4 py-1.5 text-xs ' + (params.type === tp.value ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted')}
          >
            {L(locale, tp.fa, tp.en)}
          </Link>
        ))}
      </div>

      <TagFilter all={TAG_VOCAB.map((t) => t.fa)} top={top.length ? top : TAG_VOCAB.slice(0, 8).map((t) => t.fa)} selected={selectedTags} />

      {prompts.length > 0 ? (
        <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
          {prompts.map((item) => (
            <PromptCard key={item.id} item={item} locale={locale} cornerTags={selectedTags} />
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
