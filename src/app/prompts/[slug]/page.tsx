export const revalidate = 3600

import Link from 'next/link'
import { getImageUrl } from '@/lib/image-utils'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { type Locale } from '@/lib/i18n'
import { getPromptBySlug, getRelatedPrompts, getPromptTypeLabel, L } from '@/lib/data'
import { prisma } from '@/lib/db'
import PromptCard from '@/components/prompt-card'
import SafeImg from '@/components/safe-img'
import RealCommentBox from '@/components/real-comment-box'
import PromptUserInteractions from '@/components/prompt-user-interactions'

function buildSeoTitle(raw: string): string {
  const clean = (raw || '').trim().replace(/^پرامپت\s+/i, '').trim()
  return `پرامپت ${clean} | PromptsFA`
}

export async function generateMetadata({ params }: { params: any }): Promise<Metadata> {
  try {
    const resolvedParams = params ? (params instanceof Promise ? await params : params) : null
    const slug = resolvedParams?.slug
    if (!slug || typeof slug !== 'string') return {}
    const item = await getPromptBySlug(slug, true)
    if (!item) return {}

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://promptsfa.ir'
    const pageTitle = buildSeoTitle(item.titleFa || '')
    const pageDesc = (item.descFa || `${pageTitle}. مشاهده، کپی و راهنمای استفاده از پرامپت برای مدل هوش مصنوعی ${item.model}.`).slice(0, 160)

    let ogImageUrl = `${appUrl}/placeholder.jpg`
    if (item.img && !item.img.includes('placeholder')) {
      ogImageUrl = getImageUrl(item.img)
    }

    return {
      title: pageTitle,
      description: pageDesc,
      alternates: {
        canonical: `${appUrl}/prompts/${item.slug}`,
        languages: {
          'fa-IR': `${appUrl}/prompts/${item.slug}`,
          'en-US': `${appUrl}/en/prompts/${item.slug}`,
        },
      },
      openGraph: {
        title: pageTitle,
        description: pageDesc,
        images: [{ url: ogImageUrl, width: 1200, height: 630, alt: pageTitle }],
        locale: 'fa_IR',
        siteName: 'PromptsFA',
        url: `${appUrl}/prompts/${item.slug}`,
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title: pageTitle,
        description: pageDesc,
        images: [ogImageUrl],
      },
    }
  } catch {
    return {}
  }
}

export default async function PromptDetailPage({ params, forcedLocale }: { params: any; forcedLocale?: Locale }) {
  const resolvedParams = params ? (params instanceof Promise ? await params : params) : null
  const slug = resolvedParams?.slug
  const locale: Locale = forcedLocale || 'fa'

  if (!slug || typeof slug !== 'string') {
    return (
      <section className="container-app py-16 text-center">
        <h1 className="text-2xl font-bold text-red-500">{L(locale, 'پرامپت یافت نشد', 'Prompt not found')}</h1>
        <p className="mt-4 text-ink-muted">{L(locale, 'آدرس وارد شده معتبر نمی‌باشد.', 'The requested URL is invalid.')}</p>
        <Link href="/explore" className="btn-primary mt-6 inline-flex">{L(locale, 'بازگشت به کاوش', 'Back to Explore')}</Link>
      </section>
    )
  }

  const item = await getPromptBySlug(slug, false)
  if (!item) notFound()

  const related = await getRelatedPrompts(item.categoryId || '', slug, item.tagsFa || [])

  const comments = await prisma.comment.findMany({
    where: { promptId: item.id },
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  }).catch(() => [])

  const desc = L(locale, item.descFa ?? '', item.descEn ?? '')
  const usage = L(locale, item.usageFa ?? '', item.usageEn ?? '')
  const pageHeading = buildSeoTitle(item.titleFa || '')
  const categoryName = L(locale, item.category?.nameFa ?? 'عمومی', item.category?.nameEn ?? 'General')
  const categorySlug = item.category?.slug ?? 'all'

  return (
    <section className="container-app py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'TechArticle',
            headline: pageHeading,
            description: item.descFa || item.prompt,
            image: getImageUrl(item.img),
            datePublished: item.createdAt,
            author: { '@type': 'Organization', name: 'PromptsFA', url: 'https://promptsfa.ir' },
            publisher: {
              '@type': 'Organization',
              name: 'PromptsFA',
              logo: { '@type': 'ImageObject', url: 'https://promptsfa.ir/favicon.ico' },
            },
            inLanguage: locale === 'fa' ? 'fa-IR' : 'en-US',
            keywords: (item.tagsFa || []).join(', '),
          }),
        }}
      />

      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <SafeImg 
            src={getImageUrl(item.img)} 
            isDetail={true} 
            alt={`تصویر ${pageHeading}`} 
            className="glow-gold w-full rounded-2xl object-cover" 
            loading="eager" 
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={'/categories/' + categorySlug} className="gold-badge transition-colors hover:bg-gold/25">
              {categoryName}
            </Link>
            {item.sub && (
              <Link href={'/categories/' + categorySlug + '?sub=' + item.sub.slug} className="badge transition-colors hover:border-gold/60 hover:text-gold-bright">
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
              <p className="font-bold">{item.user?.name ?? 'تیم PromptsFA'}</p>
              <p className="text-ink-faint">{L(locale, 'منتشرکننده', 'Creator')}</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm leading-7 text-ink-muted">
            <p>
              دستور و <strong>{pageHeading}</strong> در زمینه هوش مصنوعی و مدل <strong>{item.model}</strong>. با استفاده از این پرامپت آماده می‌توانید به بهترین کیفیت خروجی دست پیدا کنید.
            </p>
            {desc && <p className="mt-3">{desc}</p>}
          </div>

          <PromptUserInteractions
            promptId={item.id}
            slug={item.slug}
            initialLikes={item.likes || 0}
            initialSaves={item.saves || 0}
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

      {comments && (
        <div className="mt-16">
          <RealCommentBox promptId={item.id} initialComments={comments} />
        </div>
      )}

      {related && related.length > 0 && (
        <div className="mt-20 border-t border-line/60 pt-10">
          <h2 className="text-xl font-bold mb-6 text-ink">پرامپت‌های مرتبط</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {related.map((rel: any) => (
              <PromptCard key={rel.id} prompt={rel} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
