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
    
    // تولید slug یکتا برای پرامپت کاربر
    const slug = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

    // فراخوانی جمینای فقط برای دریافت تگ‌ها و دسته‌بندی (حالت user-submit)
    const ai = await analyzeWithGemini({ 
      text: prompt, 
      imgBase64: imgBase64 || null, 
      categories,
      mode: 'user-submit'
    })

    // ذخیره در دیتابیس با وضعیت PENDING
    const newPrompt = await prisma.prompt.create({
      data: {
        slug: slug, // ✅ فیلد اجباری اضافه شد
        prompt: prompt,
        titleFa: titleFa || ai.titleFa || 'پرامپت جدید',
        titleEn: titleEn || ai.titleEn || 'New Prompt',
        descFa: descFa || ai.descFa || prompt.slice(0, 100),
        descEn: descEn || ai.descEn || prompt.slice(0, 100),
        usageFa: usageFa || ai.usageFa || 'قابل استفاده در ابزارهای هوش مصنوعی',
        usageEn: usageEn || ai.usageEn || 'Usable in AI image generators',
        categorySlug: ai.categorySlug || 'image',
        subSlug: ai.subSlug,
        tagsFa: ai.tagsFa,
        tagsEn: ai.tagsEn,
        status: 'PENDING', // وضعیت در انتظار تایید
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
