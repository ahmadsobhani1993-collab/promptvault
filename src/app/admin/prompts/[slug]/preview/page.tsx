import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { L } from '@/lib/data'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'
import PromptActions from '@/components/admin-prompt-actions'

export const dynamic = 'force-dynamic'

export default async function AdminPromptPreview({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  const { slug } = await params
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const prompt = await prisma.prompt.findUnique({
    where: { slug },
    include: { 
      category: true,
      sub: true,
    },
  })

  if (!prompt) notFound()

  return (
    <section className="container-app py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold">
            {L(locale, 'پیش‌نمایش پرامپت', 'Prompt Preview')}
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            {L(locale, 'این پرامپت هنوز منتشر نشده است', 'This prompt is not published yet')}
            {' · '}
            <span className={
              prompt.status === 'PENDING' ? 'text-yellow-500' :
              prompt.status === 'REJECTED' ? 'text-red-500' : 'text-green-500'
            }>
              {prompt.status === 'PENDING' ? 'در انتظار' :
               prompt.status === 'REJECTED' ? 'رد شده' : 'منتشر شده'}
            </span>
          </p>
        </div>
        <Link href="/admin/prompts" className="btn-secondary text-xs">
          {L(locale, '← بازگشت به لیست', '← Back to list')}
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-line bg-elevated">
          {prompt.img ? (
            <img src={prompt.img} alt={prompt.titleFa} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-96 w-full place-items-center">
              <span className="text-6xl text-ink-faint">️</span>
            </div>
          )}
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-full bg-gold/15 px-3 py-1 text-xs text-gold-bright">
              {prompt.category?.nameFa}
            </span>
            {prompt.sub && (
              <span className="rounded-full bg-[#171512] px-3 py-1 text-xs text-ink-muted">
                {L(locale, prompt.sub.fa, prompt.sub.en)}
              </span>
            )}
          </div>

          <h2 className="font-display text-2xl font-extrabold text-ink">{prompt.titleFa}</h2>

          {prompt.descFa && (
            <p className="mt-4 text-sm leading-7 text-ink-muted">{prompt.descFa}</p>
          )}

          <div className="mt-6 flex items-center gap-4 text-xs text-ink-faint">
            <div className="flex items-center gap-1">
              <span>❤️</span>
              <span>{prompt.likes ?? 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>👁️</span>
              <span>{prompt.views ?? 0}</span>
            </div>
          </div>

          {prompt.tagsFa && prompt.tagsFa.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {prompt.tagsFa.map((tag: string) => (
                <span key={tag} className="rounded-full bg-[#171512] px-3 py-1 text-xs text-ink-muted">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card mt-8 p-6">
        <h3 className="font-display text-lg font-extrabold text-gold-bright">
          {L(locale, 'متن پرامپت', 'Prompt Text')}
        </h3>
        <div className="mt-4 rounded-xl bg-[#0a0805] p-4">
          <pre className="whitespace-pre-wrap text-sm leading-7 text-ink">{prompt.prompt}</pre>
        </div>
      </div>

      <PromptActions promptId={prompt.id} status={prompt.status} locale={locale} />
    </section>
  )
}
