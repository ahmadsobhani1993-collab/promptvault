'use server'

import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function submitPromptAction(fd: FormData) {
  const s = await auth()
  if (!s?.user?.id) return redirect('/login')
  const img = String(fd.get('img') ?? '')
  const title = String(fd.get('title') ?? '').trim()
  const prompt = String(fd.get('prompt') ?? '').trim()
  if (!img || !title || !prompt) return
  
  const catId = String(fd.get('category') ?? '')
  let finalCategoryId = catId

  if (!finalCategoryId) {
    const firstCat = await prisma.category.findFirst()
    if (firstCat) {
      finalCategoryId = firstCat.id
    } else {
      // Fallback if no categories exist in the database yet
      const defaultCat = await prisma.category.create({
        data: {
          slug: 'general',
          nameFa: 'عمومی',
          nameEn: 'General',
          icon: 'Grid',
          descFa: 'دسته‌بندی عمومی',
          descEn: 'General Category',
        }
      })
      finalCategoryId = defaultCat.id
    }
  }

  const created = await prisma.prompt.create({
    data: {
      titleFa: title,
      titleEn: title,
      descFa: String(fd.get('desc') ?? '').trim(),
      descEn: String(fd.get('desc') ?? '').trim(),
      usageFa: '',
      usageEn: '',
      slug: 'u-' + Date.now(),
      img,
      model: 'AI',
      type: 'IMAGE',
      status: 'PENDING',
      categoryId: finalCategoryId,
      tagsFa: [],
      tagsEn: [],
      prompt,
      userId: s.user.id,
    },
  })
  
  fetch((process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir') + '/api/process-submit?id=' + created.id + '&key=' + (process.env.CRON_SECRET ?? ''), { signal: AbortSignal.timeout(8000) }).catch(() => {})
  redirect('/?sent=1')
}
