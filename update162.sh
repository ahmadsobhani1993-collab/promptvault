#!/bin/bash
set -e

cat > src/app/account/page.tsx << 'EOF'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { L } from '@/lib/data'
import { cookies } from 'next/headers'
import { type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'حساب کاربری | PromptsFA' }

export default async function AccountPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('locale')?.value === 'en' ? 'en' : 'fa'

  const userId = session.user.id!

  // Get counts
  const [likesCount, savesCount, promptsCount, commentsCount] = await Promise.all([
    prisma.like.count({ where: { userId } }),
    prisma.save.count({ where: { userId } }),
    prisma.prompt.count({ where: { userId } }),
    prisma.comment.count({ where: { userId } }),
  ])

  // Get only 4 items for each section (for display)
  const [likedPrompts, savedPrompts, myPrompts, myComments] = await Promise.all([
    prisma.like.findMany({
      where: { userId },
      include: { prompt: { include: { category: true } } },
      take: 4,
    }),
    prisma.save.findMany({
      where: { userId },
      include: { prompt: { include: { category: true } } },
      take: 4,
    }),
    prisma.prompt.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
    prisma.comment.findMany({
      where: { userId },
      include: { prompt: true },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
  ])

  return (
    <section className="container-app py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{L(locale, 'حساب کاربری', 'Account')}</h1>
          <p className="mt-2 text-sm text-ink-muted">{session.user.email}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/account/edit" className="btn-secondary text-xs">
            {L(locale, 'ویرایش پروفایل', 'Edit Profile')}
          </Link>
          {session.user.role === 'ADMIN' && (
            <Link href="/admin" className="btn-primary text-xs">
              {L(locale, 'پنل مدیریت', 'Admin Panel')}
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4 text-center">
          <p className="text-xs text-ink-muted">{L(locale, 'لایک‌ها', 'Likes')}</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{likesCount}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-ink-muted">{L(locale, 'ذخیره‌ها', 'Saved')}</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{savesCount}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-ink-muted">{L(locale, 'پرامپت‌های من', 'My Prompts')}</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{promptsCount}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-ink-muted">{L(locale, 'کامنت‌ها', 'Comments')}</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-gold-bright">{commentsCount}</p>
        </div>
      </div>

      {/* Liked Prompts */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-gold-bright">
            {L(locale, 'پرامپت‌های لایک شده', 'Liked Prompts')}
          </h2>
          {likesCount > 4 && (
            <Link href="/account/likes" className="text-xs text-gold-bright hover:underline">
              {L(locale, 'مشاهده همه', 'View all')} →
            </Link>
          )}
        </div>
        {likedPrompts.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {likedPrompts.map((l) => l.prompt).filter(Boolean).map((p) => (
              <Link key={p.id} href={'/prompts/' + p.slug} className="card overflow-hidden transition-all hover:border-gold/40">
                <div className="aspect-square overflow-hidden bg-[#0f0d0a]">
                  {p.img && <img src={p.img} alt={p.titleFa} className="h-full w-full object-cover" />}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-xs font-bold">{p.titleFa}</p>
                  <p className="mt-1 text-[10px] text-ink-muted">{p.category?.nameFa}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="card p-6 text-center text-sm text-ink-faint">
            {L(locale, 'هنوز پرامپتی لایک نکرده‌اید', 'No liked prompts yet')}
          </p>
        )}
      </div>

      {/* Saved Prompts */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-gold-bright">
            {L(locale, 'پرامپت‌های ذخیره شده', 'Saved Prompts')}
          </h2>
          {savesCount > 4 && (
            <Link href="/account/saves" className="text-xs text-gold-bright hover:underline">
              {L(locale, 'مشاهده همه', 'View all')} →
            </Link>
          )}
        </div>
        {savedPrompts.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {savedPrompts.map((s) => s.prompt).filter(Boolean).map((p) => (
              <Link key={p.id} href={'/prompts/' + p.slug} className="card overflow-hidden transition-all hover:border-gold/40">
                <div className="aspect-square overflow-hidden bg-[#0f0d0a]">
                  {p.img && <img src={p.img} alt={p.titleFa} className="h-full w-full object-cover" />}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-xs font-bold">{p.titleFa}</p>
                  <p className="mt-1 text-[10px] text-ink-muted">{p.category?.nameFa}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="card p-6 text-center text-sm text-ink-faint">
            {L(locale, 'هنوز پرامپتی ذخیره نکرده‌اید', 'No saved prompts yet')}
          </p>
        )}
      </div>

      {/* My Prompts */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-gold-bright">
            {L(locale, 'پرامپت‌های ارسالی من', 'My Submitted Prompts')}
          </h2>
          {promptsCount > 4 && (
            <Link href="/account/prompts" className="text-xs text-gold-bright hover:underline">
              {L(locale, 'مشاهده همه', 'View all')} →
            </Link>
          )}
        </div>
        {myPrompts.length > 0 ? (
          <div className="card overflow-hidden">
            <div className="divide-y divide-line">
              {myPrompts.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4">
                  <div>
                    <Link href={'/prompts/' + p.slug} className="text-xs font-bold text-ink hover:text-gold-bright">
                      {p.titleFa}
                    </Link>
                    <p className="mt-1 text-[10px] text-ink-faint">
                      {new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium' }).format(p.createdAt)}
                    </p>
                  </div>
                  <span className={
                    'rounded-full px-2 py-0.5 text-[9px] ' +
                    (p.status === 'PUBLISHED' ? 'bg-green-500/15 text-green-400' :
                     p.status === 'PENDING' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400')
                  }>
                    {p.status === 'PUBLISHED' ? 'منتشر' : p.status === 'PENDING' ? 'در انتظار' : 'رد شده'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="card p-6 text-center text-sm text-ink-faint">
            {L(locale, 'هنوز پرامپتی ارسال نکرده‌اید', 'No submitted prompts yet')}
          </p>
        )}
      </div>

      {/* My Comments */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-gold-bright">
            {L(locale, 'کامنت‌های من', 'My Comments')}
          </h2>
          {commentsCount > 4 && (
            <Link href="/account/comments" className="text-xs text-gold-bright hover:underline">
              {L(locale, 'مشاهده همه', 'View all')} →
            </Link>
          )}
        </div>
        {myComments.length > 0 ? (
          <div className="card overflow-hidden">
            <div className="divide-y divide-line">
              {myComments.map((c) => (
                <div key={c.id} className="p-4">
                  <p className="text-xs text-ink">{c.text}</p>
                  <div className="mt-2 flex items-center justify-between">
                    {c.prompt && (
                      <Link href={'/prompts/' + c.prompt.slug} className="text-[10px] text-gold-bright hover:underline">
                        {c.prompt.titleFa}
                      </Link>
                    )}
                    <span className="text-[10px] text-ink-faint">
                      {new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium' }).format(c.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="card p-6 text-center text-sm text-ink-faint">
            {L(locale, 'هنوز کامنتی نگذاشته‌اید', 'No comments yet')}
          </p>
        )}
      </div>
    </section>
  )
}
EOF

echo "✅ Account page completely rewritten"