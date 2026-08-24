import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { L } from '@/lib/data'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default async function AdminPromptPreview({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/')

  const { id } = await params
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const prompt = await prisma.prompt.findUnique({
    where: { id },
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

      {/* Main content */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Image */}
        <div className="overflow-hidden rounded-2xl border border-line bg-elevated">
          {prompt.img ? (
            <img
              src={prompt.img}
              alt={prompt.titleFa}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-96 w-full place-items-center">
              <span className="text-6xl text-ink-faint"></span>
            </div>
          )}
        </div>

        {/* Info */}
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
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-red-500">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <span>{prompt.likes ?? 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>{prompt.views ?? 0}</span>
            </div>
          </div>

          {prompt.tagsFa && prompt.tagsFa.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {prompt.tagsFa.map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#171512] px-3 py-1 text-xs text-ink-muted"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Prompt text */}
      <div className="card mt-8 p-6">
        <h3 className="font-display text-lg font-extrabold text-gold-bright">
          {L(locale, 'متن پرامپت', 'Prompt Text')}
        </h3>
        <div className="mt-4 rounded-xl bg-[#0a0805] p-4">
          <pre className="whitespace-pre-wrap text-sm leading-7 text-ink">{prompt.prompt}</pre>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex gap-3">
        {prompt.status !== 'PUBLISHED' && (
          <button
            onClick={async () => {
              await fetch('/api/admin/prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: prompt.id, action: 'publish' }),
              })
              window.location.href = '/admin/prompts'
            }}
            className="btn-primary"
          >
            {L(locale, '✅ انتشار', 'Publish')}
          </button>
        )}
        {prompt.status === 'PENDING' && (
          <button
            onClick={async () => {
              await fetch('/api/admin/prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: prompt.id, action: 'reject' }),
              })
              window.location.href = '/admin/prompts'
            }}
            className="btn-secondary"
          >
            {L(locale, 'رد کردن', 'Reject')}
          </button>
        )}
      </div>
    </section>
  )
}
