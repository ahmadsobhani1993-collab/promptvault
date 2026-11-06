import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import ProfessionalDashboard from '@/components/account/ProfessionalDashboard'
import { getRequestLocale } from '@/lib/request-locale'
import { localizedPath } from '@/lib/locale-path'
import { L } from '@/lib/l'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const locale = await getRequestLocale()
  return { title: L(locale, 'حساب کاربری | PromptsFA', 'Account | PromptsFA') }
}

export default async function AccountPage() {
  const locale = await getRequestLocale()
  const session = await auth()
  if (!session?.user?.id) redirect(localizedPath(locale, '/login'))

  const userId = session.user.id

  const [user, likedPrompts, savedPrompts, myPrompts, myComments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        name: true, 
        email: true, 
        image: true, 
        role: true, 
        bio: true,
        username: true,          // ← اضافه شد
        telegram: true,          // ← اضافه شد
        instagram: true,         // ← اضافه شد
        telegramHandle: true     // ← اضافه شد
      } as any,
    }),
    prisma.like.findMany({
      where: { userId },
      select: { id: true, prompt: { select: { id: true, slug: true, titleFa: true, titleEn: true, img: true, type: true, category: { select: { nameFa: true, nameEn: true } } } } },
      orderBy: { id: 'desc' },
      take: 30,
    }),
    prisma.save.findMany({
      where: { userId },
      select: { id: true, prompt: { select: { id: true, slug: true, titleFa: true, titleEn: true, img: true, type: true, category: { select: { nameFa: true, nameEn: true } } } } },
      orderBy: { id: 'desc' },
      take: 30,
    }),
    prisma.prompt.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { id: 'desc' },
      take: 30,
    }),
    prisma.comment.findMany({
      where: { userId },
      include: { prompt: true },
      orderBy: { id: 'desc' },
      take: 30,
    }),
  ])

  return (
    <section className="container-app py-10">
      <ProfessionalDashboard
        user={user || session.user}
        likedPrompts={likedPrompts}
        savedPrompts={savedPrompts}
        myPrompts={myPrompts}
        myComments={myComments}
        cartItems={[]}
      />
    </section>
  )
}