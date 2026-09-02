import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { type Locale } from '@/lib/i18n'
import { getCategories, L } from '@/lib/data'
import { prisma } from '@/lib/db'
import ExploreClient from '@/components/explore/ExploreClient'
import CategoryIcon from '@/components/category-icon'

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 20

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { slug } = await params
  const sp = await searchParams
  const locale: Locale = (await cookies()).get('locale')?.value === 'en' ? 'en' : 'fa'

  const categories = await getCategories()
  const cat = categories.find((c) => c.slug === slug)
  if (!cat) notFound()

  const where: any = { status: 'PUBLISHED', category: { slug } }
  if (sp.sub) where.sub = { slug: sp.sub }
  if (sp.model) where.model = sp.model
  const tags = (sp.tags ?? '').split(',').filter(Boolean)
  if (tags.length) where.tagsFa = { hasSome: tags }
  if (sp.q) {
    where.OR = [
      { titleFa: { contains: sp.q, mode: 'insensitive' } },
      { titleEn: { contains: sp.q, mode: 'insensitive' } },
    ]
  }

  const sort = sp.sort === 'likes' ? 'likes' : sp.sort === 'views' ? 'views' : 'newest'
  const orderBy = sort === 'likes' ? { likes: 'desc' } : sort === 'views' ? { views: 'desc' } : { createdAt: 'desc' }

  const [rows, total, models, tagRows] = await Promise.all([
    prisma.prompt.findMany({ where, orderBy, take: PAGE_SIZE, include: { sub: true } }),
    prisma.prompt.count({ where }),
    prisma.prompt.findMany({ where: { status: 'PUBLISHED', category: { slug } }, select: { model: true }, distinct: ['model'] }),
    prisma.prompt.findMany({ where: { status: 'PUBLISHED', category: { slug } }, select: { tagsFa: true } }),
  ])

  const freq: Record<string, number> = {}
  for (const r of tagRows) for (const t of r.tagsFa) freq[t] = (freq[t] ?? 0) + 1
  const tagList = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }))

  return (
    <>
      <section className="container-app pt-10">
        <div className="flex items-center gap-5">
          <div className="glow-gold rounded-2xl bg-[#F2EAD8] p-4 text-[#171512]">
            <CategoryIcon name={cat.icon} />
          </div>
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{L(locale, cat.nameFa, cat.nameEn)}</h1>
            <p className="mt-2 text-sm text-ink-muted">{L(locale, cat.descFa, cat.descEn)}</p>
          </div>
        </div>
      </section>
      <ExploreClient
        initial={rows}
        initialTotal={total}
        locale={locale}
        basePath={process.env.NEXT_PUBLIC_APP_URL ?? ''}
        initialActive={{ q: sp.q ?? '', sub: sp.sub ?? '', model: sp.model ?? '', tags, sort }}
        filters={{ subs: cat.subs, models: models.map((m) => m.model), tags: tagList }}
      />
    </>
  )
}
