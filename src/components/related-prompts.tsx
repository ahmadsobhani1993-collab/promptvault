import Link from 'next/link'
import { prisma } from '@/lib/db'
import { L } from '@/lib/data'
import { type Locale } from '@/lib/i18n'

// این خط به ورسل می‌گوید این کامپوننت را کش کند و مثلاً هر ۱ ساعت (یا ۱ روز) بازبینی کند.
// چون منطق ما ماهی یک‌بار تغییر می‌کند، این کش کاملاً ایمن و بهینه است.
export const revalidate = 3600 

// الگوریتم شافل قطعی (Deterministic Shuffle) مبتنی بر یک رشته (Seed)
// این تابع بدون استفاده از Math.random()، آرایه را به‌صورت قابل پیش‌بینی بر می‌زند.
function seededShuffle<T>(array: T[], seed: string): T[] {
  let seedNum = 0
  for (let i = 0; i < seed.length; i++) {
    seedNum += seed.charCodeAt(i)
  }

  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Linear Congruential Generator (LCG) برای تولید عدد شبه‌تصادفی قطعی
    seedNum = (seedNum * 9301 + 49297) % 233280
    const j = Math.floor((seedNum / 233280) * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

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

  // تولید بذر بر اساس سال و ماه جاری (مثلاً: "2023-10")
  // این باعث می‌شود چیدمان کارت‌ها در کل این ماه ثابت بماند و کش ورسل خراب نشود.
  const now = new Date()
  const monthlySeed = `${now.getFullYear()}-${now.getMonth() + 1}`

  // ۱. دریافت یک استخر (Pool) ثابت از ۳۰ پرامپت مرتبط و محبوب
  const pool = await prisma.prompt.findMany({
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
    orderBy: [{ likes: 'desc' }, { createdAt: 'desc' }],
    take: 30, // استخر ۳۰ تایی برای انتخاب ماهانه
  })

  if (!pool || pool.length === 0) return null

  // ۲. بر زدن قطعی استخر بر اساس ماه جاری و انتخاب ۴ کارت
  const related = seededShuffle(pool, monthlySeed).slice(0, 4)

  return (
    <section className="mt-16 border-t border-line/60 pt-10">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-gold-bright flex items-center gap-2">
          <span>✨</span>
          <span>{L(locale, 'پیشنهادهای ویژه این ماه', 'Monthly Picks')}</span>
        </h2>
        <span className="text-xs text-ink-faint">
          {L(locale, 'انتخاب شده بر اساس محبوبیت و دسته‌بندی', 'Curated by topic & popularity')}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {related.map((item) => {
          const promptHref = isEn ? `/en/prompts/${item.slug}` : `/prompts/${item.slug}`
          const title = isEn && item.titleEn ? item.titleEn : item.titleFa
          const categoryName = isEn && item.category?.nameEn ? item.category.nameEn : item.category?.nameFa

          // بررسی دقیق‌تر تصویر برای جلوگیری از کارت‌های سیاه (رشته خالی یا فاصله)
          const hasValidImage = item.img && typeof item.img === 'string' && item.img.trim().length > 0 && item.img !== 'null'

          return (
            <Link
              key={item.id}
              href={promptHref}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-line/60 bg-[#120f0c] transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:shadow-xl hover:shadow-gold/5"
            >
              <div className="aspect-square w-full overflow-hidden bg-[#0a0806] relative">
                {hasValidImage ? (
                  <img
                    src={item.img}
                    alt={title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      // اگر لینک تصویر شکسته بود، fallback را نشان بده
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.parentElement!.querySelector('.fallback-icon')!.classList.remove('hidden')
                    }}
                  />
                ) : null}
                
                {/* Fallback Icon */}
                <div className={`fallback-icon ${hasValidImage ? 'hidden' : ''} grid h-full w-full place-items-center`}>
                  <span className="text-3xl text-zinc-700">🎨</span>
                </div>

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
                  
                  {/* نمایش همزمان ویو و لایک */}
                  <div className="flex items-center gap-2">
                    {/* آیکون ویو (چشم) */}
                    <div className="flex items-center gap-1 text-zinc-400">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span>{item.views ?? 0}</span>
                    </div>

                    {/* آیکون لایک (قلب) */}
                    <div className="flex items-center gap-1 text-zinc-400">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 text-red-400/80">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                      <span>{item.likes ?? 0}</span>
                    </div>
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