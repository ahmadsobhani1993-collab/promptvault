import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import { prisma } from '@/lib/db'
import { L } from '@/lib/data'
import { getImageUrl } from '@/lib/image-utils'
import PromptCard from '@/components/prompt-card'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const prompt = await prisma.prompt.findUnique({ where: { slug } })
  if (!prompt) return { title: 'پرامپت یافت نشد' }
  
  const title = prompt.titleFa
  const description = prompt.descFa || `پرامپت هوش مصنوعی ${prompt.titleFa} - بیش از ${prompt.views || 0} بازدید`
  
  return {
    title: title,
    description: description,
    keywords: [`پرامپت هوش مصنوعی ${prompt.titleFa}`, 'پرامپت فا', 'AI Prompt', prompt.titleFa],
    openGraph: {
      title,
      description,
      images: [prompt.img],
      type: 'article',
      locale: 'fa_IR',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [prompt.img],
    },
  }
}

export default async function PromptPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'
  
  const prompt = await prisma.prompt.findUnique({
    where: { slug },
    include: {
      category: true,
    },
  })
  
  if (!prompt) notFound()

  const relatedPrompts = await prisma.prompt.findMany({
    where: {
      categoryId: prompt.categoryId,
      slug: { not: slug },
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
  })

  return (
    <>
      <section className="container-app py-12">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Image */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-primary/20">
            <img
              src={getImageUrl(prompt.img)}
              alt={L(locale, prompt.titleFa, prompt.titleEn)}
              className="w-full object-cover"
            />
          </div>

          {/* Content */}
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-display text-3xl font-extrabold text-ink">
                {L(locale, prompt.titleFa, prompt.titleEn)}
              </h1>
              <div className="flex gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  {L(locale, 'تصویر', 'Image')}
                </span>
                {prompt.createdAt && Date.now() - new Date(prompt.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000 && (
                  <span className="rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
                    {L(locale, 'جدید', 'New')}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                <span className="text-sm font-bold text-primary-foreground">P</span>
              </div>
              <div>
                <p className="font-medium text-ink">PromptsFA تیم</p>
                <p className="text-sm text-ink-subtle">{L(locale, 'منتشرکننده', 'Publisher')}</p>
              </div>
            </div>

            <div className="prose prose-invert mt-6 max-w-none">
              <p className="text-ink-subtle">
                {L(locale, prompt.descFa, prompt.descEn) || prompt.titleFa}
              </p>
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-wrap gap-3">
              <button className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                {L(locale, 'اشتراک', 'Share')}
              </button>
              <button className="rounded-xl border border-border px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-1">
                {L(locale, 'پسند', 'Like')} ۰
              </button>
              <button className="rounded-xl border border-border px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-1">
                {L(locale, 'ذخیره', 'Save')} ۰
              </button>
            </div>

            {/* Tags */}
            <div className="mt-6 flex flex-wrap gap-2">
              {prompt.tagsFa?.map((tag, i) => (
                <span
                  key={i}
                  className="rounded-full bg-surface-1 px-3 py-1 text-sm text-ink-subtle"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Prompt Text */}
        <div className="mt-12 rounded-2xl border border-border bg-surface-1 p-6">
          <h2 className="font-display text-xl font-bold text-ink">
            {L(locale, 'پرامپت', 'Prompt')}
          </h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-surface-2 p-4 text-sm text-ink-subtle">
            {prompt.prompt}
          </pre>
        </div>
      </section>

      {/* Related Prompts */}
      {relatedPrompts.length > 0 && (
        <section className="container-app py-12">
          <h2 className="font-display text-2xl font-bold text-ink">
            {L(locale, 'پرامپت‌های مرتبط', 'Related Prompts')}
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
            {relatedPrompts.map((item) => (
              <PromptCard key={item.id} item={item} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
