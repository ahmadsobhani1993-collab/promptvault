import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { type Locale } from '@/lib/i18n'
import { getArticleBySlug, L } from '@/lib/data'
import ShareButtons from '@/components/share-buttons'
import SafeImg from '@/components/safe-img'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const a = await getArticleBySlug(slug)
  if (!a) return {}
  return {
    title: a.titleFa,
    description: a.descFa,
    openGraph: {
      title: a.titleFa,
      description: a.descFa,
      images: [{ url: a.img }],
      locale: 'fa_IR',
      siteName: 'PromptsFA',
      type: 'article',
    },
    twitter: { card: 'summary_large_image', title: a.titleFa, description: a.descFa },
  }
}

export const dynamic = 'force-dynamic'

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const a = await getArticleBySlug(slug)
  if (!a) notFound()

  const body = (a as any).contentFa ?? ''

  return (
    <article className="container-app max-w-3xl py-16">
      <span className="gold-badge">{L(locale, a.tagFa, a.tagEn)}</span>
      <h1 className="mt-5 font-display text-3xl font-extrabold leading-snug tracking-tight md:text-4xl">
        {L(locale, a.titleFa, a.titleEn)}
      </h1>
      <p className="mt-4 text-sm leading-8 text-ink-muted">{L(locale, a.descFa, a.descEn)}</p>

      <div className="mt-8">
        <SafeImg src={a.img} alt={L(locale, a.titleFa, a.titleEn)} className="glow-gold w-full rounded-2xl object-cover" loading="eager" />
      </div>

      <div
        className="article-body mt-10 text-sm leading-8 text-ink-muted"
        dangerouslySetInnerHTML={{ __html: body }}
      />

      <div className="mt-12 border-t border-line/60 pt-6">
        <ShareButtons title={L(locale, a.titleFa, a.titleEn)} desc={a.descFa} />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: a.titleFa,
            description: a.descFa,
            image: a.img,
            datePublished: a.createdAt,
            inLanguage: 'fa',
            author: { '@type': 'Organization', name: 'PromptsFA' },
          }),
        }}
      />
    </article>
  )
}
