
const getImageUrl = (url: string | null | undefined) => {
  if (!url) return '/placeholder.jpg';
  if (url.includes('api.telegram.org')) {
    return '/api/image-proxy?url=' + encodeURIComponent(url);
  }
  return url;
};

import Link from 'next/link'

import { cookies } from 'next/headers'

  if (!url) return "/placeholder.jpg";
  if (url.includes("api.telegram.org")) {
    return "/api/image-proxy?url=" + encodeURIComponent(url);
  }
  return url;
};
import { notFound } from 'next/navigation'

  if (!url) return "/placeholder.jpg";
  if (url.includes("api.telegram.org")) {
    return "/api/image-proxy?url=" + encodeURIComponent(url);
  }
  return url;
};
import type { Metadata } from 'next'

  if (!url) return "/placeholder.jpg";
  if (url.includes("api.telegram.org")) {
    return "/api/image-proxy?url=" + encodeURIComponent(url);
  }
  return url;
};
import { type Locale } from '@/lib/i18n'

  if (!url) return "/placeholder.jpg";
  if (url.includes("api.telegram.org")) {
    return "/api/image-proxy?url=" + encodeURIComponent(url);
  }
  return url;
};
import { getPromptBySlug, getRelatedPrompts, getPromptTypeLabel, L } from '@/lib/data'

  if (!url) return "/placeholder.jpg";
  if (url.includes("api.telegram.org")) {
    return "/api/image-proxy?url=" + encodeURIComponent(url);
  }
  return url;
};
import { prisma } from '@/lib/db'

  if (!url) return "/placeholder.jpg";
  if (url.includes("api.telegram.org")) {
    return "/api/image-proxy?url=" + encodeURIComponent(url);
  }
  return url;
};
import { auth } from '@/auth'

  if (!url) return "/placeholder.jpg";
  if (url.includes("api.telegram.org")) {
    return "/api/image-proxy?url=" + encodeURIComponent(url);
  }
  return url;
};
import PromptCard from '@/components/prompt-card'

  if (!url) return "/placeholder.jpg";
  if (url.includes("api.telegram.org")) {
    return "/api/image-proxy?url=" + encodeURIComponent(url);
  }
  return url;
};
import CopyButton from '@/components/copy-button'

  if (!url) return "/placeholder.jpg";
  if (url.includes("api.telegram.org")) {
    return "/api/image-proxy?url=" + encodeURIComponent(url);
  }
  return url;
};
import RealLikeButton from '@/components/real-like-button'

  if (!url) return "/placeholder.jpg";
  if (url.includes("api.telegram.org")) {
    return "/api/image-proxy?url=" + encodeURIComponent(url);
  }
  return url;
};
import SaveButton from '@/components/save-button'

  if (!url) return "/placeholder.jpg";
  if (url.includes("api.telegram.org")) {
    return "/api/image-proxy?url=" + encodeURIComponent(url);
  }
  return url;
};
import SafeImg from '@/components/safe-img'

  if (!url) return "/placeholder.jpg";
  if (url.includes("api.telegram.org")) {
    return "/api/image-proxy?url=" + encodeURIComponent(url);
  }
  return url;
};
import PromptReveal from '@/components/prompt-reveal'

  if (!url) return "/placeholder.jpg";
  if (url.includes("api.telegram.org")) {
    return "/api/image-proxy?url=" + encodeURIComponent(url);
  }
  return url;
};
import ShareButtons from '@/components/share-buttons'

  if (!url) return "/placeholder.jpg";
  if (url.includes("api.telegram.org")) {
    return "/api/image-proxy?url=" + encodeURIComponent(url);
  }
  return url;
};
import RealCommentBox from '@/components/real-comment-box'

  if (!url) return "/placeholder.jpg";
  if (url.includes("api.telegram.org")) {
    return "/api/image-proxy?url=" + encodeURIComponent(url);
  }
  return url;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const item = await getPromptBySlug(slug)
  if (!item) return {}
  return {
    title: item.titleFa,
    description: (item.descFa ?? item.prompt).slice(0, 150),
    openGraph: {
      title: '✨ ' + item.titleFa,
      description: (item.descFa ?? item.titleFa) + ' — دیدن و کپی پرامپت در PromptsFA',
      images: [{ url: item.img.replace('output=webp', 'output=jpg'), width: 900, height: 900 }],
      locale: 'fa_IR',
      siteName: 'PromptsFA',
      url: (process.env.NEXT_PUBLIC_APP_URL ?? '') + '/prompts/' + item.slug,
      type: 'article',
    },
    twitter: { card: 'summary_large_image', title: item.titleFa, description: item.descFa ?? '' },
  }
}

export const dynamic = 'force-dynamic'

export default async function PromptDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  const session = await auth()

  // شمارش بازدید
  await prisma.prompt.updateMany({ where: { slug }, data: { views: { increment: 1 } } })

  const item = await getPromptBySlug(slug)
  if (!item) notFound()

  const related = await getRelatedPrompts(item.categoryId, slug)

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

          <PromptReveal
            slug={item.slug}
            revealLabel={L(locale, 'نمایش پرامپت', 'Reveal Prompt')}
            copyLabel={L(locale, 'کپی پرامپت', 'Copy Prompt')}
            copiedLabel={L(locale, 'کپی شد!', 'Copied!')}
            hint={L(locale, 'پرامپت برای محافظت در برابر اسکرپینگ، فقط بعد از کلیک نمایش داده می‌شود.', 'The prompt is revealed on click to protect against scraping.') }
          />

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
          }),
        }}
      />
    </section>
  )
}
