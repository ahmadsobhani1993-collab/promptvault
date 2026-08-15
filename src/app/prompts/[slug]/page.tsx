import Link from 'next/link'
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
import RealCommentBox from '@/components/real-comment-box'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const item = await getPromptBySlug(slug)
  if (!item) return {}
  return {
    title: item.titleFa,
    description: (item.descFa ?? item.prompt).slice(0, 150),
    openGraph: {
      title: item.titleFa,
      description: item.descFa ?? '',
      images: [{ url: item.img }],
      locale: 'fa_IR',
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
          <img src={item.img} alt={L(locale, item.titleFa, item.titleEn)} className="glow-gold w-full rounded-2xl object-cover" />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={'/categories/' + item.category.slug} className="gold-badge transition-colors hover:bg-gold/25">
              {L(locale, item.category.nameFa, item.category.nameEn)}
            </Link>
            <span className="badge">{getPromptTypeLabel(item.type, locale)}</span>
            <span className="badge">{item.model}</span>
          </div>

          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">
            {L(locale, item.titleFa, item.titleEn)}
          </h1>

          {desc && <p className="mt-4 text-sm leading-7 text-ink-muted">{desc}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <RealLikeButton promptId={item.id} initialLiked={liked} initialCount={item.likes} label={L(locale, 'پسند', 'likes')} requireLogin={L(locale, 'برای لایک کردن ابتدا وارد شو', 'Login to like')} />
            <SaveButton promptId={item.id} initialSaved={saved} initialCount={item.saves} label={L(locale, 'ذخیره', 'saves')} requireLogin={L(locale, 'برای ذخیره کردن ابتدا وارد شو', 'Login to save')} />
          </div>

          <div className="mt-5 flex flex-wrap gap-1">
            {item.tagsFa.map((tag, i) => L(locale, tag, item.tagsEn[i] ?? tag)).map((tag) => (
              <Link
                key={tag}
                href={'/explore?q=' + encodeURIComponent(tag)}
                className="badge transition-colors hover:border-gold/60 hover:text-gold-bright"
              >
                {tag}
              </Link>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-gold/40 bg-[#0d0b07] p-5">
            <p className="text-xs font-bold text-gold-bright">Prompt</p>
            <p dir="ltr" className="mt-3 text-left font-mono text-sm leading-7 text-[#e8d9ae]">{item.prompt}</p>
            <div className="mt-5">
              <CopyButton text={item.prompt} label={L(locale, 'کپی پرامپت', 'Copy Prompt')} copiedLabel={L(locale, 'کپی شد!', 'Copied!')} />
            </div>
          </div>

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
    </section>
  )
}
