import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { generatePlaceholderCover } from '@/lib/cover-generator'

export async function POST(req: Request) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { items, defaultCategory = 'code', type = 'code' } = await req.json()
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'آیتمی ارسال نشده است' }, { status: 400 })
  }

  let cat = await prisma.category.findFirst({
    where: { OR: [{ slug: defaultCategory }, { slug: 'code' }] }
  })
  if (!cat) {
    cat = await prisma.category.findFirst()
  }

  const results = []
  for (const row of items) {
    const title = row.title || row.titleFa || 'پرامپت جدید'
    const slug = (row.slug || title)
      .toLowerCase()
      .trim()
      .replace(/[^\w\u0600-\u06FF\s-]/g, '')
      .replace(/\s+/g, '-') + '-' + Math.random().toString(36).substring(2, 6)

    const img = row.img && row.img.startsWith('http') 
      ? row.img 
      : generatePlaceholderCover(title, type)

    const promptRecord = await prisma.prompt.create({
      data: {
        titleFa: title,
        titleEn: row.titleEn || title,
        prompt: row.prompt || row.code || '',
        descFa: row.descFa || '',
        slug,
        img,
        type: type === 'code' ? 'CODE' : type === 'audio' ? 'AUDIO' : 'TEXT',
        categoryId: cat ? cat.id : '',
      }
    }).catch(() => null)

    if (promptRecord) results.push(promptRecord.id)
  }

  return NextResponse.json({ success: true, count: results.length })
}