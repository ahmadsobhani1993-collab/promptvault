import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { getCategories } from '@/lib/data'
import { prisma } from '@/lib/db'
import { TAG_VOCAB } from '@/lib/gemini'
import ExploreClient from '@/components/explore/ExploreClient'

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 20

// 🔑 فقط فیلدهای لازم برای کارت — بدون prompt text سنگین
const CARD_SELECT = {
  slug: true,
  titleFa: true,
  titleEn: true,
  img: true,
  model: true,
  type: true,
  views: true,
  likes: true,
  stars: true,
  tagsFa: true,
  tagsEn: true,
  createdAt: true,
  category: true,
  sub: true,
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const locale: Locale = (await cookies()).get('locale')?.value === 'en' ? 'en' : 'fa'

  const categories = await getCategories()
  const allSubs = categories.flatMap((c) => c.subs)

  const where: any = { status: 'PUBLISHED' }
  if (params.q) {
    where.OR = [
      { titleFa: { contains: params.q, mode: 'insensitive' } },
      { titleEn: { contains: params.q, mode: 'insensitive' } },
    ]
  }
  if (params.sub) where.sub = { slug: params.sub }
  if (params.model) where.model = params.model
  const tags = (params.tags ?? '').split(',').filter(Boolean)
  if (tags.length) where.tagsFa = { hasSome: tags }

  const sort = params.sort === 'likes' ? 'likes' : params.sort === 'views' ? 'views' : 'newest'
  const orderBy = sort === 'likes' ? { likes: 'desc' } : sort === 'views' ? { views: 'desc' } : { createdAt: 'desc' }

  const [rows, total, models] = await Promise.all([
    prisma.prompt.findMany({ where, orderBy, take: PAGE_SIZE, select: CARD_SELECT }),
    prisma.prompt.count({ where }),
    prisma.prompt.findMany({ where: { status: 'PUBLISHED' }, select: { model: true }, distinct: ['model'] }),
  ])

  // 🔑 تگ‌ها از vocab ثابت — بدون query سنگین روی همه پست‌ها
  const tagList = TAG_VOCAB.map((t) => ({ tag: t.fa, count: 0 }))

  return (
    <ExploreClient
      initial={rows}
      initialTotal={total}
      locale={locale}
      basePath={process.env.NEXT_PUBLIC_APP_URL ?? ''}
      initialActive={{
        q: params.q ?? '',
        type: params.type ?? '',
        sub: params.sub ?? '',
        model: params.model ?? '',
        tags,
        sort,
      }}
      filters={{ subs: allSubs, models: models.map((m) => m.model), tags: tagList }}
    />
  )
}
