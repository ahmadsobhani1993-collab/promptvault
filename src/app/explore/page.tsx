import Link from 'next/link'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { promptTypes, L } from '@/lib/data'
import { TAG_VOCAB } from '@/lib/gemini'
import { prisma } from '@/lib/db'
import TagFilter from '@/components/tag-filter'
import ExploreGrid from '@/components/explore-grid'

export const metadata = { title: 'کاوش', description: 'جستجو و فیلتر پرامپت‌ها' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const selectedTags = (params.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 2)
  const sort = params.sort === 'likes' ? 'likes' : params.sort === 'views' ? 'views' : 'newest'
  const model = params.model ?? ''

  const where: any = { status: 'PUBLISHED' }
  if (params.type) where.type = params.type
  if (model) where.model = model
  if (selectedTags.length) where.tagsFa = { hasEvery: selectedTags }
  if (params.q) {
    const q = params.q
    where.OR = [
      { titleFa: { contains: q, mode: 'insensitive' } },
      { titleEn: { contains: q, mode: 'insensitive' } },
      { prompt: { contains: q, mode: 'insensitive' } },
      { tagsFa: { hasSome: [q] } },
      { tagsEn: { hasSome: [q] } },
    ]
  }

  const orderBy = sort === 'likes' ? { likes: 'desc' as const } : sort === 'views' ? { views: 'desc' as const } : { createdAt: 'desc' as const }
  const [rows, models, allTagsRows] = await Promise.all([
    prisma.prompt.findMany({ where, orderBy, take: PAGE_SIZE, include: { category: true } }),
    prisma.prompt.findMany({ where: { status: 'PUBLISHED' }, select: { model: true }, distinct: ['model'] }),
    prisma.prompt.findMany({ where: { status: 'PUBLISHED' }, select: { tagsFa: true } }),
  ])

  const freq: Record<string, number> = {}
  for (const r of allTagsRows) for (const t of r.tagsFa) freq[t] = (freq[t] ?? 0) + 1
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map((e) => e[0])

  const qs = (over: Record<string, string | undefined>) => {
    const sp = new URLSearchParams()
    const merged = { ...params, ...over }
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v)
    return sp.toString()
  }
  const chip = (active: boolean) =>
    'rounded-full border px-4 py-1.5 text-xs transition-colors ' +
    (active ? 'border-gold bg-gold/15 text-gold-bright' : 'border-line bg-elevated text-ink-muted hover:border-gold/40')

  return (
    <section className="container-app py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{L(locale, 'کاوش', 'Explore')}</h1>

      <form action="/explore" className="mt-6 flex max-w-2xl gap-3">
        <input name="q" defaultValue={params.q ?? ''} placeholder={L(locale, 'جستجو در پرامپت‌ها...', 'Search prompts...')} className="input text-base" />
        <button type="submit" className="btn-primary whitespace-nowrap">{L(locale, 'جستجو', 'Search')}</button>
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        {promptTypes.map((t) => (
          <Link key={t.value} href={'/explore?' + qs({ type: t.value })} className={chip(params.type === t.value)}>
            {L(locale, t.fa, t.en)}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={'/explore?' + qs({ sort: 'newest' })} className={chip(sort === 'newest')}>{L(locale, 'جدید', 'New')}</Link>
        <Link href={'/explore?' + qs({ sort: 'likes' })} className={chip(sort === 'likes')}>{L(locale, 'محبوب', 'Popular')}</Link>
        <Link href={'/explore?' + qs({ sort: 'views' })} className={chip(sort === 'views')}>{L(locale, 'پربازدید', 'Trending')}</Link>
      </div>

      {top.length > 0 && (
        <div className="mt-4">
          <TagFilter tags={top} selected={selectedTags} />
        </div>
      )}

      {models.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {models.map((m) => (
            <Link key={m.model} href={'/explore?' + qs({ model: m.model })} className={chip(model === m.model)}>{m.model}</Link>
          ))}
        </div>
      )}

      <div className="mt-10">
        <ExploreGrid initial={rows} params={params as Record<string, string>} locale={locale} />
      </div>
    </section>
  )
}
