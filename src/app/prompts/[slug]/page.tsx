export const revalidate = 3600
import Link from 'next/link'
import { getImageUrl } from '@/lib/image-utils';
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { type Locale } from '@/lib/i18n'
import { getPromptBySlug, getRelatedPrompts, getPromptTypeLabel, L } from '@/lib/data'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import PromptCard from '@/components/prompt-card'
import CopyButton from '@/components/copy-button'
import RealLikeButton from '@/components/real-like-button'
import SaveButton from '@/components/save-button'
import SafeImg from '@/components/safe-img'
import PromptReveal from '@/components/prompt-reveal'
import ShareButtons from '@/components/share-buttons'
import RealCommentBox from '@/components/real-comment-box'

export async function generateMetadata({ params }: { params: any }): Promise<Metadata> {
  try {
    const resolvedParams = params ? (params instanceof Promise ? await params : params) : null
    const slug = resolvedParams && typeof resolvedParams === 'object' ? (resolvedParams as any).slug : undefined
    if (!slug || typeof slug !== 'string') return {}
    const item = await getPromptBySlug(slug, true)
    if (!item) return {}

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://promptsfa.ir'
    const pageTitle = `پرامپت ${item.titleFa} | PromptsFA`
    const pageDesc = (item.descFa ?? item.prompt ?? '').slice(0, 150)

    let ogImageUrl = `${appUrl}/placeholder.jpg`
    if (item.img && !item.img.includes('placeholder')) {
      if (item.img.includes('res.cloudinary.com') && item.img.includes('/upload/')) {
        ogImageUrl = item.img.replace('/upload/', '/upload/w_1200,h_630,c_fill,q_auto:good,f_jpg/')
      } else {
        ogImageUrl = item.img
      }
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
        title: item.titleFa,
        description: pageDesc,
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: item.titleFa,
          },
        ],
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

export default async function PromptDetailPage({ params, forcedLocale }: { params: any, forcedLocale?: Locale }) {
  const resolvedParams = params ? (params instanceof Promise ? await params : params) : null
  const slug = resolvedParams && typeof resolvedParams === 'object' ? (resolvedParams as any).slug : undefined

  const cookieStore = await cookies()
    const { headers } = await import('next/headers')
  const reqHeaders = await headers()
  const referer = reqHeaders.get('referer') || ''
  const currentPath = reqHeaders.get('x-pathname') || reqHeaders.get('x-invoke-path') || ''
  const isEnRoute = currentPath.startsWith('/en') || referer.includes('/en/')
  const locale: Locale = forcedLocale || (isEnRoute || cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa')

  if (!slug || typeof slug !== 'string') {
    return (
      <section className="container-app py-16 text-center">
        <h1 className="text-2xl font-bold text-red-500">{L(locale, 'پرامپت یافت نشد', 'Prompt not found')}</h1>
        <p className="mt-4 text-ink-muted">{L(locale, 'آدرس وارد شده معتبر نمی‌باشد.', 'The requested URL is invalid.')}</p>
        <Link href="/explore" className="btn-primary mt-6 inline-flex">{L(locale, 'بازگشت به کاوش', 'Back to Explore')}</Link>
      </section>
    )
  }

  const session = await auth()
  const isAdmin = session?.user?.role === 'ADMIN'

  // شمارش بازدید
  // views counter removed from SSR to preserve edge cache

  const item = await getPromptBySlug(slug, isAdmin)
  if (!item) notFound()

  const related = await getRelatedPrompts(item.categoryId, slug, item.tagsFa || [])

  const userId = session?.user?.id
  let liked = false
  let saved = false
  if (userId) {
    liked = !!(await prisma.like.findUnique({ where: { userId_promptId: { userId, promptId: item.id } } }))
    saved = !!(await prisma.save.findUnique({ where: { userId_promptId: { userId, promptId: item.id } } }))
  }

  const comments = await prisma.comment.findMany({
    where: { promptId: item.id },
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  })

  const desc = L(locale, item.descFa ?? '', item.descEn ?? '')
  const usage = L(locale, item.usageFa ?? '', item.usageEn ?? '')

  return (
    <section className="container-app py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'TechArticle',
            headline: item.titleFa,
            description: item.descFa || item.prompt,
            image: item.img,
            datePublished: item.createdAt,
            author: {
              '@type': 'Organization',
              name: 'PromptsFA',
              url: 'https://promptsfa.ir',
            },
            publisher: {
              '@type': 'Organization',
              name: 'PromptsFA',
              logo: {
                '@type': 'ImageObject',
                url: 'https://promptsfa.ir/favicon.ico',
              },
            },
            inLanguage: locale === 'fa' ? 'fa-IR' : 'en-US',
            keywords: (item.tagsFa || []).join(', '),
          }),
        }}
      />
      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <SafeImg src={item.img} alt={L(locale, item.titleFa, item.titleEn)} className="glow-gold w-full rounded-2xl object-cover" loading="eager" />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={'/categories/' + item.category.slug} className="gold-badge transition-colors hover:bg-gold/25">
              {L(locale, item.category.nameFa, item.category.nameEn)}
            </Link>
            {item.sub && (
              <Link href={'/categories/' + item.category.slug + '?sub=' + item.sub.slug} className="badge transition-colors hover:border-gold/60 hover:text-gold-bright">
                {L(locale, item.sub.fa, item.sub.en)}
              </Link>
            )}
            <span className="badge">{getPromptTypeLabel(item.type, locale)}</span>
            <span className="badge">{item.model}</span>
          </div>

          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">
            {L(locale, item.titleFa, item.titleEn)}
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

          {desc && <p className="mt-4 text-sm leading-7 text-ink-muted">{desc}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <RealLikeButton promptId={item.id} initialLiked={liked} initialCount={item.likes} label={L(locale, 'پسند', 'likes')} requireLogin={L(locale, 'برای لایک کردن ابتدا وارد شو', 'Login to like')} />
            <SaveButton promptId={item.id} initialSaved={saved} initialCount={item.saves} label={L(locale, 'ذخیره', 'saves')} requireLogin={L(locale, 'برای ذخیره کردن ابتدا وارد شو', 'Login to save')} />
            <ShareButtons title={L(locale, item.titleFa, item.titleEn)} desc={L(locale, item.descFa ?? '', item.descEn ?? '')} />
          </div>

          <div className="mt-5 flex flex-wrap gap-1">
            {item.tagsFa.map((tag, i) => L(locale, tag, item.tagsEn[i] ?? tag)).map((tag) => (
              <Link
                key={tag}
                href={'/explore?tags=' + encodeURIComponent(tag)}
                className="badge transition-colors hover:border-gold/60 hover:text-gold-bright"
              >
                {tag}
              </Link>
            ))}
          </div>

          {userId ? (
            <PromptReveal
              slug={item.slug}
              revealLabel={L(locale, 'نمایش پرامپت', 'Reveal Prompt')}
              copyLabel={L(locale, 'کپی پرامپت', 'Copy Prompt')}
              copiedLabel={L(locale, 'کپی شد!', 'Copied!')}
              hint={L(locale, 'پرامپت برای محافظت در برابر اسکرپینگ، فقط بعد از کلیک نمایش داده می‌شود.', 'The prompt is revealed on click to protect against scraping.') }
             locale={locale} />
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-gold/40 bg-gold/5 p-6 text-center">
              <p className="text-sm text-ink-muted">
                {L(locale, 'برای مشاهده و کپی کردن متن پرامپت، ابتدا باید وارد حساب کاربری خود شوید.', 'To view and copy the prompt text, you must first log in to your account.')}
              </p>
              <Link href="/login" className="btn-primary mt-4 inline-flex">
                {L(locale, 'ورود به حساب کاربری', 'Login to Account')}
              </Link>
            </div>
          )}

          {usage && (
            <div className="mt-6 rounded-2xl border border-line bg-elevated p-5">
              <p className="text-xs font-bold text-gold-bright">
                {L(locale, '📘 راهنمای استفاده', '📘 How to use')}
              </p>
              <p className="mt-3 text-sm leading-7 text-ink-muted">{usage}</p>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-20">
          <h2 className="font-display text-xl font-bold tracking-tight">{L(locale, 'پرامپت‌های مشابه', 'Related prompts')}</h2>
          <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3">
            {related.map((r) => (
              <PromptCard key={r.id} item={r} locale={locale} />
            ))}
          </div>
        </div>
      )}

      <RealCommentBox
        initial={comments.map((c) => ({ id: c.id, name: c.user?.name ?? c.name, image: c.user?.image ?? null, text: c.text, createdAt: new Date(c.createdAt).toLocaleString('fa-IR') }))}
        targetId={item.id}
        targetType="prompt"
        titleLabel={L(locale, 'دیدگاه‌ها', 'Comments')}
        textPlaceholder={L(locale, 'دیدگاهت را بنویس...', 'Write your comment...')}
        submitLabel={L(locale, 'ارسال دیدگاه', 'Submit')}
        loginRequired={L(locale, 'برای ارسال دیدگاه ابتدا وارد شو', 'Login to comment')}
        isLoggedIn={!!userId}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CreativeWork',
            name: item.titleFa,
            alternateName: item.titleEn,
            description: item.descFa ?? '',
            image: item.img,
            inLanguage: ['fa', 'en'],
            creator: { '@type': 'Person', name: item.user?.name ?? 'PromptsFA' },
            datePublished: item.createdAt,
            url: `${process.env.NEXT_PUBLIC_APP_URL || "https://promptsfa.ir"}/prompts/${item.slug}`,
            headline: item.titleFa,
            keywords: "پرامپت, هوش مصنوعی, میدجرنی, استیبل دیفیوژن",
          }),
        }}
      />
    </section>
  )
}













