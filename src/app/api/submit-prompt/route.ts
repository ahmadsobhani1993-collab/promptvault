import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { title, prompt, description, category, tags, email } = body

    if (!title || !prompt) {
      return NextResponse.json({ error: 'عنوان و متن پرامپت الزامی است' }, { status: 400 })
    }

    // پیدا کردن دسته‌بندی (اگر وجود نداشت، از اولین دسته‌بندی استفاده می‌کند)
    const categoryRecord = await prisma.category.findFirst({
      where: { slug: category || 'portrait' },
    })

    // ساخت یک slug یکتا بر اساس زمان
    const slug = `user-${Date.now()}`

    // پردازش تگ‌ها
    const tagsArray = tags
      ? tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : []

    // ذخیره در دیتابیس با وضعیت PENDING (در انتظار بررسی)
    const newPrompt = await prisma.prompt.create({
      data: {
        slug,
        titleFa: title,
        titleEn: title,
        prompt,
        descFa: description || '',
        descEn: description || '',
        tagsFa: tagsArray,
        tagsEn: tagsArray,
        categoryId: categoryRecord?.id || null,
        status: 'PENDING', // این خط کلیدی است: پرامپت فوراً منتشر نمی‌شود
        type: 'IMAGE',
        model: 'User Submitted',
        views: 0,
      },
    })

    return NextResponse.json({ ok: true, message: 'پرامپت با موفقیت ارسال شد' })
  } catch (error) {
    console.error('Submit prompt error:', error)
    return NextResponse.json({ error: 'خطا در ذخیره پرامپت' }, { status: 500 })
  }
}
