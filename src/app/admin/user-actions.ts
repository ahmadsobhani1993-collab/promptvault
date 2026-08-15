'use server'

import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function promoteUser(id: string) {
  await requireAdmin()
  await prisma.user.update({ where: { id }, data: { role: 'ADMIN' } })
  revalidatePath('/admin', 'layout')
}

export async function demoteUser(id: string) {
  const session = await requireAdmin()
  if (session.user.id === id) return
  await prisma.user.update({ where: { id }, data: { role: 'USER' } })
  revalidatePath('/admin', 'layout')
}
