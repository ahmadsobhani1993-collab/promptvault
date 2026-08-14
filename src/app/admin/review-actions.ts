'use server'

import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function approvePrompt(id: string) {
  await requireAdmin()
  await prisma.prompt.update({ where: { id }, data: { status: 'PUBLISHED' } })
  revalidatePath('/', 'layout')
}

export async function rejectPrompt(id: string) {
  await requireAdmin()
  await prisma.prompt.update({ where: { id }, data: { status: 'REJECTED' } })
  revalidatePath('/', 'layout')
}
