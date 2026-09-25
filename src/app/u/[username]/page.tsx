import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { id: username }],
    },
    select: { name: true, username: true },
  })

  if (!user) return { title: 'کاربر یافت نشد | PromptsFA' }
  return {
    title: `${user.name || user.username} | پروفایل کاربر در PromptsFA`,
  }
}

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { id: username }],
    },
    include: {
      prompts: {
        where: { published: true },
        take: 20,
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          prompts: true,
          comments: true,
          likes: true,
        },
      },
    },
  })

  if (!user) notFound()

  return (
    <main className="container-app min-h-[80vh] py-12" dir="rtl">
      {/* هدر پروفایل کاربر */}
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/60 p-6 md:p-8 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-right">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name || ''}
              className="h-24 w-24 rounded-full border-2 border-amber-500/60 object-cover shadow-xl"
            />
          ) : (
            <div className="grid h-24 w-24 place-items-center rounded-full border-2 border-amber-500/40 bg-amber-500/10 text-3xl font-black text-amber-400">
              {user.name ? user.name[0] : 'U'}
            </div>
          )}

          <div className="flex-1">
            <h1 className="font-display text-2xl font-black text-white">
              {user.name || 'کاربر بدون نام'}
            </h1>
            <p className="mt-1 text-xs font-mono text-amber-400">@{user.username || user.id}</p>
            {user.bio && <p className="mt-3 text-xs leading-relaxed text-stone-300 max-w-xl">{user.bio}</p>}

            <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-4 text-xs text-stone-400">
              <span>📝 <strong className="text-white">{user._count.prompts}</strong> پرامپت</span>
              <span>💬 <strong className="text-white">{user._count.comments}</strong> نظر</span>
              <span>❤️ <strong className="text-white">{user._count.likes}</strong> لایک</span>
            </div>
          </div>
        </div>
      </div>

      {/* پرامپت‌های منتشر شده توسط این کاربر */}
      <div className="mx-auto max-w-4xl mt-8">
        <h2 className="text-base font-bold text-white mb-4">پرامپت‌های اشتراک‌گذاری شده</h2>
        {user.prompts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-xs text-stone-500">
            هنوز پرامپتی توسط این کاربر منتشر نشده است.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {user.prompts.map((p) => (
              <Link
                key={p.id}
                href={`/prompts/${p.slug || p.id}`}
                className="group rounded-2xl border border-white/10 bg-zinc-900/40 p-4 transition hover:border-amber-500/40 hover:bg-zinc-900/70"
              >
                <h3 className="font-bold text-sm text-stone-200 group-hover:text-amber-400 transition">
                  {p.title}
                </h3>
                <p className="mt-2 text-xs text-stone-400 line-clamp-2">{p.content}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
