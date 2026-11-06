import Link from 'next/link'
import { getImageUrl } from '@/lib/image-utils'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { type Locale } from '@/lib/i18n'
import { getPromptForPage, getRelatedPrompts, getPromptTypeLabel } from '@/lib/data'
import { L } from '@/lib/l'
import { buildSeoTitle, generatePromptMetadata } from '@/lib/prompt-seo'
import { getRequestLocale } from '@/lib/request-locale'
import { prisma } from '@/lib/db'
import PromptCard from '@/components/prompt-card'
import SafeImg from '@/components/safe-img'
import RealCommentBox from '@/components/real-comment-box'
import PromptUserInteractions from '@/components/prompt-user-interactions'
import { localizedPath } from '@/lib/locale-path'

// ISR: rendered once, served from the CDN, regenerated at most once per day.
export const revalidate = 86400
export const dynamicParams = true

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return generatePromptMetadata(params, 'fa')
}

async function loadComments(promptId: string): Promise<any[]> {
  try {
    const raw = await prisma.comment.findMany({
      where: { promptId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      // Only public fields: never ship the full user row (email etc.) to the client
      include: { user: { select: { id: true, name: true, image: true } } },
    })
    return raw.map((c: any) => {
      const { user, ...rest } = c
      return {
        ...rest,
        userId: rest.userId ?? user?.id ?? null,
        name: rest.name ?? user?.name ?? 'کاربر',
        image: rest.image ?? user?.image ?? null,
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
        updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : null,
      }
    })
  } catch {
    return []
  }
}

export default async function PromptDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const locale: Locale = await getRequestLocale()

  if (!slug || typeof slug !== 'string') {
    return (
      <section className="container-app py-16 text-center">
        <h1 className="text-2xl font-bold text-red-500">{L(locale, 'پرامپت یافت نشد', 'Prompt not found')}</h1>
        <p className="mt-4 text-ink-muted">{L(locale, 'آدرس وارد شده معتبر نمی‌باشد.', 'The requested URL is invalid.')}</p>
        <Link href={localizedPath(locale, '/explore')} prefetch={false} className="btn-primary mt-6 inline-flex">{L(locale, 'بازگشت به کاوش', 'Back to Explore')}</Link>
      </section>
    )
  }

  const item = await getPromptForPage(slug)
  if (!item) notFound()

  const safeTagsFa = Array.isArray(item.tagsFa) ? item.tagsFa : []

  const [relatedAll, serializedComments] = await Promise.all([
    getRelatedPrompts(item.categoryId || '', slug, safeTagsFa).catch(() => []),
    loadComments(item.id),
  ])
  const related = Array.isArray(relatedAll) ? relatedAll.slice(0, 4) : []

  const desc = locale === 'en'
    ? item.descEn || `${item.titleEn || 'This prompt'} for ${item.model || 'AI tools'} — ready to use.`
    : item.descFa ?? ''
  const usage = locale === 'en' ? item.usageEn ?? '' : item.usageFa ?? ''
  const pageHeading = locale === 'fa'
    ? buildSeoTitle(item.titleFa || '')
    : `${item.titleEn || 'AI prompt'} | PromptsFA`
  const categoryName = L(locale, item.category?.nameFa ?? 'عمومی', item.category?.nameEn ?? 'General')
  const categorySlug = item.category?.slug ?? 'all'
  const finalImgUrl = getImageUrl(item.img)

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: pageHeading,
    // Never fall back to the prompt text: it is login-gated
    description: desc || pageHeading,
    image: finalImgUrl,
    datePublished: item.createdAt ? new Date(item.createdAt).toISOString() : undefined,
    author: { '@type': 'Organization', name: 'PromptsFA', url: 'https://promptsfa.ir' },
    publisher: {
      '@type': 'Organization',
      name: 'PromptsFA',
      logo: { '@type': 'ImageObject', url: 'https://promptsfa.ir/favicon.ico' },
    },
    inLanguage: locale === 'fa' ? 'fa-IR' : 'en-US',
    keywords: safeTagsFa.join(', '),
  }).replace(/</g, '\\u003c')

  return (
    <section className="container-app py-16">
      {/* <--- تغییر ۲: اضافه شدن کامپوننت ردیاب ویو */}
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <SafeImg
            src={finalImgUrl}
            isDetail={true}
            alt={`تصویر ${pageHeading}`}
            className="glow-gold w-full rounded-2xl object-cover"
            loading="eager"
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={localizedPath(locale, '/categories/' + categorySlug)} prefetch={false} className="gold-badge transition-colors hover:bg-gold/25">
              {categoryName}
            </Link>
            {item.sub && (
              <Link href={localizedPath(locale, '/categories/' + categorySlug + '?sub=' + item.sub.slug)} prefetch={false} className="badge transition-colors hover:border-gold/60 hover:text-gold-bright">
                {L(locale, item.sub.fa, item.sub.en)}
              </Link>
            )}
            <span className="badge">{getPromptTypeLabel(item.type, locale)}</span>
            <span className="badge">{item.model}</span>
          </div>

          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">
            {pageHeading}
          </h1>

          <div className="mt-4 flex items-center gap-3">
            {item.user?.image ? (
              <img src={item.user.image} alt="" className="h-8 w-8 rounded-full" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gold/20 text-[10px] font-bold text-gold-bright">P</span>
            )}
            <div className="text-xs">
              <p className="font-bold">              {locale === 'en' ? (item.user?.name ?? 'PromptsFA Team') : (item.user?.name ?? 'تیم PromptsFA')}</p>
              <p className="text-ink-faint">{L(locale, 'منتشرکننده', 'Creator')}</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm leading-7 text-ink-muted">
            <p>
              {locale === 'en'
                ? <>This <strong>{pageHeading}</strong> prompt is designed for AI tools such as <strong>{item.model}</strong>. Use it to generate high-quality results.</>
                : <>دستور و <strong>{pageHeading}</strong> در زمینه هوش مصنوعی و مدل <strong>{item.model}</strong>. با استفاده از این پرامپت آماده می‌توانید به بهترین کیفیت خروجی دست پیدا کنید.</>}
            </p>
            {desc && <p className="mt-3">{desc}</p>}
          </div>

          <PromptUserInteractions
            promptId={item.id}
            slug={item.slug}
            initialLikes={Number(item.likes) || 0}
            initialSaves={Number(item.saves) || 0}
            pageHeading={pageHeading}
            desc={desc}
            locale={locale}
          />

          {usage && (
            <div className="mt-6 rounded-2xl border border-line bg-elevated p-5">
              <h2 className="text-sm font-bold text-gold-bright">
                {L(locale, '📖 راهنمای استفاده', '📖 How to use')}
              </h2>
              <p className="mt-3 text-sm leading-7 text-ink-muted">{usage}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-16">
        <RealCommentBox targetId={item.id} initial={serializedComments} locale={locale} />
      </div>

      {related.length > 0 && (
        <div className="mt-20 border-t border-line/60 pt-10">
          <h2 className="text-xl font-bold mb-6 text-ink">{L(locale, 'پرامپت‌های مرتبط', 'Related prompts')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((rel: any) => (
              <PromptCard key={rel.id} prompt={rel} locale={locale} hideStats />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
