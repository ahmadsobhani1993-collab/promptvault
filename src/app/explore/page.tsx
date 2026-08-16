import Link from 'next/link'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { promptTypes, L } from '@/lib/data'
import { TAG_VOCAB } from '@/lib/gemini'
import { prisma } from '@/lib/db'
import PromptCard from '@/components/prompt-card'
import TagFilter from '@/components/tag-filter'

export const metadata = { title: 'کاوش', description: 'جستجو و فیلتر پرامپت‌ها' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const selectedTags = (params.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 2)
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
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

  const orderBy =
    sort === 'likes' ? { likes: 'desc' as const } : sort === 'views' ? { views: 'desc' as const } : { createdAt: 'desc' as const }

  const [rows, total, models, allTagsRows] = await Promise.all([
    prisma.prompt.findMany({ where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { category: true, sub: true } }),
    prisma.prompt.count({ where }),
    prisma.prompt.findMany({ where: { status: 'PUBLISHED' }, select: { model: true }, distinct: ['model'] }),
    prisma.prompt.findMany({ where: { status: 'PUBLISHED' }, select: { tagsFa: true } }),
  ])

  const freq: Record<string, number> = {}
  for (const r of allTagsRows) for (const t of r.tagsFa) freq[t] = (freq[t] ?? 0) + 1
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map((e) => e[0])

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

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
        <input
          name="q"
          defaultValue={params.q ?? ''}
          placeholder={L(locale, 'جستجو در پرامپت‌ها...', 'Search prompts...')}
          className="input text-base"
        />
        <button type="submit" className="btn-primary shrink-0">{L(locale, 'جستجو', 'Search')}</button>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link href={'/explore?' + qs({ type: undefined, page: undefined })} className={chip(!params.type)}>
          {L(locale, 'همه', 'All')}
        </Link>
        {promptTypes.map((tp) => (
          <Link key={tp.value} href={'/explore?' + qs({ type: tp.value, page: undefined })} className={chip(params.type === tp.value)}>
            {L(locale, tp.fa, tp.en)}
          </Link>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-ink-faint">{L(locale, 'مرتب‌سازی:', 'Sort:')}</span>
        <Link href={'/explore?' + qs({ sort: undefined, page: undefined })} className={chip(sort === 'newest')}>{L(locale, 'جدیدترین', 'Newest')}</Link>
        <Link href={'/explore?' + qs({ sort: 'likes', page: undefined })} className={chip(sort === 'likes')}>{L(locale, 'پرپسندترین', 'Most liked')}</Link>
        <Link href={'/explore?' + qs({ sort: 'views', page: undefined })} className={chip(sort === 'views')}>{L(locale, 'پربازدیدترین', 'Most viewed')}</Link>

        {models.length > 0 && (
          <>
            <span className="mr-4 text-ink-faint">{L(locale, 'مدل:', 'Model:')}</span>
            {models.map((m) => (
              <Link key={m.model} href={'/explore?' + qs({ model: model === m.model ? undefined : m.model, page: undefined })} className={chip(model === m.model)}>
                {m.model}
              </Link>
            ))}
          </>
        )}
      </div>

      <TagFilter all={TAG_VOCAB.map((t) => t.fa)} top={top.length ? top : TAG_VOCAB.slice(0, 8).map((t) => t.fa)} selected={selectedTags} />

      <p className="mt-6 text-xs text-ink-faint">{total} {L(locale, 'نتیجه', 'results')}</p>

      {rows.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
          {rows.map((item) => (
            <PromptCard
              key={item.id}
              item={item}
              locale={locale}
              cornerTags={selectedTags}
              isNew={Date.now() - new Date(item.createdAt).getTime() < 48 * 3600 * 1000}
            />
          ))}
        </div>
      ) : (
        <div className="card mt-10 p-10 text-center text-sm text-ink-muted">
          {L(locale, 'نتیجه‌ای پیدا نشد.', 'No results found.')}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-12 flex items-center justify-center gap-4 text-sm">
          {page > 1 && (
            <Link className="btn-secondary" href={'/explore?' + qs({ page: String(page - 1) })}>
              {L(locale, '← قبلی', '← Prev')}
            </Link>
          )}
          <span className="text-xs text-ink-muted">{page} / {pages}</span>
          {page < pages && (
            <Link className="btn-secondary" href={'/explore?' + qs({ page: String(page + 1) })}>
              {L(locale, 'بعدی →', 'Next →')}
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
