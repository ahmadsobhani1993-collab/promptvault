import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzeWithGemini } from '@/lib/gemini'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { prompt, titleFa, titleEn, descFa, descEn, usageFa, usageEn, imgBase64 } = body

    if (!prompt) return NextResponse.json({ ok: false, error: 'Prompt is required' }, { status: 400 })

    const categories = await prisma.category.findMany({ include: { subs: true } })
    
    // فراخوانی جمینای فقط برای دریافت تگ‌ها (حالت user-submit)
    const ai = await analyzeWithGemini({ 
      text: prompt, 
      imgBase64: imgBase64 || null, 
      categories,
      mode: 'user-submit' // این خط حیاتی است
    })

    // ذخیره در دیتابیس با وضعیت در انتظار تایید (PENDING)
    // توجه: اگر در schema شما فیلد status وجود ندارد، باید آن را اضافه کنید (PENDING, APPROVED, REJECTED)
    const newPrompt = await prisma.prompt.create({
      data: {
        prompt: prompt, // متن اصلی کاربر بدون تغییر
        titleFa: titleFa || ai.titleFa, // اولویت با متن کاربر
        titleEn: titleEn || ai.titleEn,
        descFa: descFa || ai.descFa,
        descEn: descEn || ai.descEn,
        usageFa: usageFa || ai.usageFa,
        usageEn: usageEn || ai.usageEn,
        categorySlug: ai.categorySlug,
        subSlug: ai.subSlug,
        tagsFa: ai.tagsFa, // فقط تگ‌ها از جمینای گرفته می‌شود
        tagsEn: ai.tagsEn,
        status: 'PENDING', // ارسال به صف انتظار تایید مدیریت
        source: 'user_submit'
      }
    })

    // ⛔️ هیچ کدی برای ارسال به تلگرام (tgSendPhoto و ...) در اینجا وجود ندارد.

    return NextResponse.json({ 
      ok: true, 
      message: 'پرامپت با موفقیت ثبت شد و در صف انتظار تایید مدیریت قرار گرفت.',
      id: newPrompt.id
    })

  } catch (e: any) {
    console.error('[Submit Error]', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
