import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { type Locale } from '@/lib/i18n'
import { getArticleBySlug, L } from '@/lib/data'
import { getRequestLocale } from '@/lib/request-locale'
import { localizedPath } from '@/lib/locale-path'
import ShareButtons from '@/components/share-buttons'
import SafeImg from '@/components/safe-img'
import { getImageUrl } from '@/lib/image-utils';
import { articleContentToHtml } from '@/lib/article-content'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const a = await getArticleBySlug(slug)
  if (!a) return {}
  const locale = await getRequestLocale()
  const title = L(locale, a.titleFa, a.titleEn)
  const description = L(locale, a.descFa, a.descEn)
  const canonicalPath = `${locale === 'en' ? '/en' : ''}/blog/${slug}`
  return {
    title,
    description,
    alternates: {
      canonical: `https://promptsfa.ir${canonicalPath}`,
      languages: {
        'fa-IR': `https://promptsfa.ir/blog/${slug}`,
        'en-US': `https://promptsfa.ir/en/blog/${slug}`,
      },
    },
    openGraph: {
      title,
      description,
      images: [{ url: a.img }],
      locale: locale === 'en' ? 'en_US' : 'fa_IR',
      siteName: 'PromptsFA',
      type: 'article',
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export const dynamic = 'force-dynamic'


export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const locale: Locale = await getRequestLocale()
  const a = await getArticleBySlug(slug)
  if (!a) notFound()

  const body = articleContentToHtml(locale === 'en' ? a.contentEn : a.contentFa)
  const title = L(locale, a.titleFa, a.titleEn)
  const description = L(locale, a.descFa, a.descEn)
  const isNews = a.tagFa === 'اخبار'
  const date = new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
    timeZone: 'Asia/Tehran',
    dateStyle: 'long',
  }).format(a.createdAt)

  return (
    <article className="container-app max-w-5xl py-8 md:py-12">
      <nav aria-label={L(locale, 'مسیر صفحه', 'Breadcrumb')} className="mb-6 text-xs text-ink-faint">
        <Link href={localizedPath(locale, '/blog')} className="transition-colors hover:text-gold-bright">{L(locale, 'وبلاگ', 'Blog')}</Link>
        <span className="mx-2">/</span>
        {isNews ? <Link href={localizedPath(locale, '/news')} className="transition-colors hover:text-gold-bright">{L(locale, 'اخبار', 'News')}</Link> : <span>{L(locale, 'مقاله', 'Article')}</span>}
      </nav>

      <header className="mx-auto max-w-3xl text-center">
        <span className="gold-badge">{isNews ? L(locale, 'اخبار هوش مصنوعی', 'AI news') : L(locale, a.tagFa, a.tagEn)}</span>
        <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">{title}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-ink-muted md:text-base">{description}</p>
        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-ink-faint">
          <time dateTime={a.createdAt.toISOString()}>{date}</time>
          <span aria-hidden="true">·</span>
          <span>{L(locale, a.readFa, a.readEn)}</span>
        </div>
      </header>

      <figure className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-3xl border border-line/70 bg-surface shadow-2xl">
        <SafeImg src={getImageUrl(a.img)} alt={title} className="aspect-[16/9] w-full object-cover" loading="eager" />
      </figure>

      <div className="article-body mx-auto mt-10 max-w-3xl rounded-3xl border border-line/60 bg-surface/70 px-5 py-7 text-sm leading-8 text-ink-muted shadow-card md:px-10 md:py-10 md:text-base md:leading-9" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
        {body ? <div dangerouslySetInnerHTML={{ __html: body }} /> : <p>{description}</p>}
      </div>

      <div className="mx-auto mt-10 max-w-3xl border-t border-line/60 pt-6">
        <ShareButtons title={title} desc={description} />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': isNews ? 'NewsArticle' : 'BlogPosting',
            headline: title,
            description,
            image: a.img,
            datePublished: a.createdAt,
            dateModified: a.createdAt,
            inLanguage: locale,
            author: { '@type': 'Organization', name: 'PromptsFA' },
            mainEntityOfPage: `https://promptsfa.ir${locale === 'en' ? '/en' : ''}/blog/${a.slug}`,
          }),
        }}
      />
    </article>
  )
}
