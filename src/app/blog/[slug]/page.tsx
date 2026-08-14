import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { type Locale } from '@/lib/i18n'
import { articles, prompts, L } from '@/lib/data'
import PromptCard from '@/components/prompt-card'
import LikeButton from '@/components/like-button'
import CommentBox from '@/components/comment-box'

const relatedMap: Record<string, string[]> = {
  'midjourney-starter': ['cinematic-portrait-rain', 'luxury-product-shot', 'vibrant-studio-portrait'],
  'better-prompts': ['ad-copywriting', 'content-assistant', 'dark-fantasy-character'],
  'flux-vs-sd': ['luxury-product-shot', 'dark-fantasy-character', 'futuristic-architecture'],
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const a = articles.find((x) => x.slug === slug)
  if (!a) return {}
  return { title: a.titleFa, description: a.descFa }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const a = articles.find((x) => x.slug === slug)
  if (!a) notFound()

  const content = locale === 'fa' ? a.contentFa : a.contentEn
  const others = articles.filter((x) => x.slug !== slug)
  const relatedSlugs = relatedMap[slug] ?? []
  const related = prompts.filter((p) => relatedSlugs.includes(p.slug))

  return (
    <article className="container-app max-w-4xl py-16">
      <Link href="/blog" className="text-xs text-gold-bright hover:text-gold">
        {L(locale, '← بازگشت به وبلاگ', '← Back to blog')}
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href={'/explore?q=' + encodeURIComponent(L(locale, a.tagFa, a.tagEn))}
          className="gold-badge transition-colors hover:bg-gold/20"
        >
          {L(locale, a.tagFa, a.tagEn)}
        </Link>
        <span className="text-xs text-ink-faint">{L(locale, a.dateFa, a.dateEn)}</span>
        <span className="text-xs text-ink-faint">{L(locale, a.readFa, a.readEn)}</span>
      </div>

      <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        {L(locale, a.titleFa, a.titleEn)}
      </h1>

      <img
        src={a.img}
        alt={L(locale, a.titleFa, a.titleEn)}
        className="glow-gold mt-8 w-full rounded-2xl object-cover"
      />

      <div className="mt-8 space-y-6">
        {content.map((p) => (
          <p key={p.slice(0, 20)} className="text-base leading-8 text-ink-muted">
            {p}
          </p>
        ))}
      </div>

      <div className="mt-10 flex items-center gap-3">
        <LikeButton initial={128} label={L(locale, 'پسند', 'likes')} />
      </div>

      {related.length > 0 && (
        <div className="mt-14">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {L(locale, 'پرامپت‌های مرتبط', 'Related prompts')}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3">
            {related.map((r) => (
              <PromptCard key={r.slug} item={r} locale={locale} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-14">
        <h2 className="font-display text-xl font-bold tracking-tight">
          {L(locale, 'سایر مقالات', 'More articles')}
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {others.map((o) => (
            <Link key={o.slug} href={'/blog/' + o.slug} className="card flex items-center gap-4 p-4 transition-colors hover:border-line-strong">
              <img src={o.img} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <div>
                <p className="line-clamp-1 text-sm font-bold text-ink">
                  {L(locale, o.titleFa, o.titleEn)}
                </p>
                <p className="mt-1 text-[10px] text-ink-faint">
                  {L(locale, o.readFa, o.readEn)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <CommentBox
        initial={[
          { name: 'سارا', text: L(locale, 'عالی بود، دقیقاً چیزی که نیاز داشتم!', 'Great, exactly what I needed!') },
          { name: 'Ali', text: L(locale, 'نکات خیلی کاربردی بودند.', 'Very practical tips.') },
        ]}
        titleLabel={L(locale, 'دیدگاه‌ها', 'Comments')}
        namePlaceholder={L(locale, 'نام تو', 'Your name')}
        textPlaceholder={L(locale, 'دیدگاهت را بنویس...', 'Write your comment...')}
        submitLabel={L(locale, 'ارسال دیدگاه', 'Submit')}
      />
    </article>
  )
}
