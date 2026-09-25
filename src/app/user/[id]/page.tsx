import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ id: string }>
}

export default async function UserRedirectPage({ params }: Props) {
  const { id } = await params
  const user = await prisma.user.findFirst({
    where: { OR: [{ id }, { username: id }] },
    select: { username: true, id: true }
  })

  if (user) {
    redirect(`/u/${user.username || user.id}`)
  }
  redirect('/')
}
