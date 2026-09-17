import Link from 'next/link'
import { prisma } from '@/lib/db'
import { L } from '@/lib/data'
import { type Locale } from '@/lib/i18n'

export default async function RelatedPrompts({
  articleTags = [],
  articleSlug,
  categoryId,
  locale = 'fa',
}: {
  articleTags?: string[]
  articleSlug: string
  categoryId?: string
  locale?: Locale
}) {
  const isEn = locale === 'en'

  // اولویت ۱: پرامپت‌های هم‌دسته با تگ‌های مشترک
  // اولویت ۲: پرامپت‌های دیگر همان دسته‌بندی
  const related = await prisma.prompt.findMany({
    where: {
      status: 'PUBLISHED',
      NOT: { slug: articleSlug },
      OR: [
        ...(articleTags && articleTags.length > 0 ? [{ tagsFa: { hasSome: articleTags } }] : []),
        ...(categoryId ? [{ categoryId }] : []),
      ],
    },
    select: {
      id: true,
      slug: true,
      titleFa: true,
      titleEn: true,
      img: true,
      model: true,
      type: true,
      views: true,
      likes: true,
      category: { select: { nameFa: true, nameEn: true, slug: true } },
    },
    orderBy: [
      { likes: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 6,
  })

  if (!related || related.length === 0) return null

  return (
    <section className="mt-16 border-t border-line/60 pt-10">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-gold-bright flex items-center gap-2">
          <span>✨</span>
          <span>{L(locale, 'پرامپت‌های مرتبط و مشابه', 'Related Prompts')}</span>
        </h2>
        <span className="text-xs text-ink-faint">
          {L(locale, 'پیشنهاد شده بر اساس تم و دسته‌بندی', 'Suggested by topic & style')}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {related.map((item) => {
          const promptHref = isEn ? `/en/prompts/${item.slug}` : `/prompts/${item.slug}`
          const title = isEn && item.titleEn ? item.titleEn : item.titleFa
          const categoryName = isEn && item.category?.nameEn ? item.category.nameEn : item.category?.nameFa

          return (
            <Link
              key={item.id}
              href={promptHref}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-line/60 bg-[#120f0c] transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:shadow-xl hover:shadow-gold/5"
            >
              <div className="aspect-square w-full overflow-hidden bg-[#0a0806] relative">
                {item.img ? (
                  <img
                    src={item.img}
                    alt={title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <span className="text-3xl text-zinc-700">🎨</span>
                  </div>
                )}
                {categoryName && (
                  <span className="absolute top-2 right-2 rounded-md bg-black/60 backdrop-blur-md border border-white/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                    {categoryName}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col justify-between p-3">
                <p className="line-clamp-2 text-xs font-semibold text-zinc-200 group-hover:text-amber-300 transition-colors">
                  {title}
                </p>

                <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-zinc-500">
                  <span className="font-mono">
                    {item.model || 'AI'}
                  </span>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 text-red-400/80">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                    <span>{item.likes ?? 0}</span>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

