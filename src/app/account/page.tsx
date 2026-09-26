import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import ProfessionalDashboard from '@/components/account/ProfessionalDashboard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'حساب کاربری | PromptsFA' }

export default async function AccountPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

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
      include: { prompt: { include: { category: true } } },
      orderBy: { id: 'desc' },
      take: 30,
    }),
    prisma.save.findMany({
      where: { userId },
      include: { prompt: { include: { category: true } } },
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