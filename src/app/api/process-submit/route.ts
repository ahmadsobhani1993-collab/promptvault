import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzeWithGemini } from '@/lib/gemini'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { prompt, titleFa, titleEn, descFa, descEn, usageFa, usageEn, imgBase64 } = body

    if (!prompt) return NextResponse.json({ ok: false, error: 'Prompt is required' }, { status: 400 })

    const categories = await prisma.category.findMany({ include: { subs: true } })
    const slug = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

    const ai = await analyzeWithGemini({ 
      text: prompt, 
      imgBase64: imgBase64 || null, 
      categories,
      mode: 'user-submit'
    })

    // ✅ پیدا کردن ID دسته‌بندی و زیردسته‌بندی بر اساس اسلاگ برگشتی از جمینای
    const targetCategory = categories.find(c => c.slug === ai.categorySlug) || categories[0]
    const categoryId = targetCategory.id

    let subId: string | null = null
    if (ai.subSlug && targetCategory.subs) {
      const targetSub = targetCategory.subs.find(s => s.slug === ai.subSlug)
      if (targetSub) subId = targetSub.id
    }

    const defaultImg = "https://placehold.co/600x400/1a1a1a/FFF/png?text=Prompt"

    const newPrompt = await prisma.prompt.create({
      data: {
        slug: slug,
        prompt: prompt,
        titleFa: titleFa || ai.titleFa || 'پرامپت جدید',
        titleEn: titleEn || ai.titleEn || 'New Prompt',
        descFa: descFa || ai.descFa || prompt.slice(0, 100),
        descEn: descEn || ai.descEn || prompt.slice(0, 100),
        usageFa: usageFa || ai.usageFa || 'قابل استفاده در ابزارهای هوش مصنوعی',
        usageEn: usageEn || ai.usageEn || 'Usable in AI image generators',
        categoryId: categoryId,       // ✅ اصلاح شد
        subId: subId,                 // ✅ اصلاح شد
        tagsFa: ai.tagsFa,
        tagsEn: ai.tagsEn,
        img: defaultImg,
        status: 'PENDING',
        source: 'user_submit',
        type: 'IMAGE',
        model: 'AI'
      }
    })

    return NextResponse.json({ 
      ok: true, 
      message: 'پرامپت با موفقیت ثبت شد و در صف انتظار تایید مدیریت قرار گرفت.',
      slug: newPrompt.slug
    })

  } catch (e: any) {
    console.error('[Submit Error]', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
