'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin'

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function tags(str: string) {
  return str.split(/[,،]/).map((t) => t.trim()).filter(Boolean)
}

export async function createPrompt(fd: FormData) {
  await requireAdmin()
  const titleEn = fd.get('titleEn') as string
  await prisma.prompt.create({
    data: {
      titleFa: fd.get('titleFa') as string,
      titleEn,
      slug: slugify((fd.get('slug') as string) || titleEn),
      img: fd.get('img') as string,
      model: fd.get('model') as string,
      type: (fd.get('type') as string) as any,
      categoryId: fd.get('categoryId') as string,
      subId: (fd.get('subId') as string) || null,
      tagsFa: tags(fd.get('tagsFa') as string),
      tagsEn: tags(fd.get('tagsEn') as string),
      prompt: fd.get('prompt') as string,
    },
  })
  revalidatePath('/', 'layout')
  redirect('/admin/prompts')
}

export async function updatePrompt(id: string, fd: FormData) {
  await requireAdmin()
  const titleEn = fd.get('titleEn') as string
  await prisma.prompt.update({
    where: { id },
    data: {
      titleFa: fd.get('titleFa') as string,
      titleEn,
      slug: slugify((fd.get('slug') as string) || titleEn),
      img: fd.get('img') as string,
      model: fd.get('model') as string,
      type: (fd.get('type') as string) as any,
      categoryId: fd.get('categoryId') as string,
      subId: (fd.get('subId') as string) || null,
      tagsFa: tags(fd.get('tagsFa') as string),
      tagsEn: tags(fd.get('tagsEn') as string),
      prompt: fd.get('prompt') as string,
    },
  })
  revalidatePath('/', 'layout')
  redirect('/admin/prompts')
}

export async function deletePrompt(id: string) {
  await requireAdmin()
  await prisma.prompt.delete({ where: { id } })
  revalidatePath('/', 'layout')
}

export async function createArticle(fd: FormData) {
  await requireAdmin()
  const titleEn = fd.get('titleEn') as string
  const lines = (s: string) => (s as string).split('\n').map((x) => x.trim()).filter(Boolean)
  await prisma.article.create({
    data: {
      titleFa: fd.get('titleFa') as string,
      titleEn,
      slug: slugify((fd.get('slug') as string) || titleEn),
      descFa: fd.get('descFa') as string,
      descEn: fd.get('descEn') as string,
      img: fd.get('img') as string,
      tagFa: fd.get('tagFa') as string,
      tagEn: fd.get('tagEn') as string,
      dateFa: fd.get('dateFa') as string,
      dateEn: fd.get('dateEn') as string,
      readFa: fd.get('readFa') as string,
      readEn: fd.get('readEn') as string,
      contentFa: lines(fd.get('contentFa') as string),
      contentEn: lines(fd.get('contentEn') as string),
    },
  })
  revalidatePath('/', 'layout')
  redirect('/admin/articles')
}

export async function deleteArticle(id: string) {
  await requireAdmin()
  await prisma.article.delete({ where: { id } })
  revalidatePath('/', 'layout')
}

export async function createCategory(fd: FormData) {
  await requireAdmin()
  const subsRaw = (fd.get('subs') as string) || ''
  const subs = subsRaw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [slug, fa, en] = l.split('|').map((x) => x?.trim())
      return { slug: slugify(slug || fa), fa, en: en || fa }
    })
  await prisma.category.create({
    data: {
      slug: slugify(fd.get('slug') as string || (fd.get('nameEn') as string)),
      nameFa: fd.get('nameFa') as string,
      nameEn: fd.get('nameEn') as string,
      icon: fd.get('icon') as string,
      descFa: fd.get('descFa') as string,
      descEn: fd.get('descEn') as string,
      subs: { create: subs },
    },
  })
  revalidatePath('/', 'layout')
}

export async function deleteCategory(id: string) {
  await requireAdmin()
  await prisma.category.delete({ where: { id } })
  revalidatePath('/', 'layout')
}

export async function deleteComment(id: string) {
  await requireAdmin()
  await prisma.comment.delete({ where: { id } })
  revalidatePath('/', 'layout')
}
