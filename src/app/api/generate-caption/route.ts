import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { text, tone = 'engaging', locale = 'fa' } = await req.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'متن ورودی خالی است' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'کلید GEMINI_API_KEY در متغیرهای محیطی سرور تنظیم نشده است' }, { status: 500 })
    }

    const tonePrompts: Record<string, string> = {
      engaging: 'هیجانی، جذاب و اکسپلوری همراه با قلاب (Hook) جذاب در خط اول',
      professional: 'آموزشی، بسیار تخصصی و تحلیلی',
      friendly: 'صمیمی، داستانی و ساده',
      minimal: 'بسیار کوتاه، تک‌جمله‌ای و کوبنده'
    }

    const systemPrompt = `تو یک ادمین حرفه‌ای وایرال اینستاگرام هستی. بر اساس متن زیر، یک کپشن حرفه‌ای و جذاب برای پست اینستاگرام بنویس.
زبان خروجی: ${locale === 'fa' ? 'فارسی' : 'English'}
لحن کپشن: ${tonePrompts[tone] || tonePrompts.engaging}

قوانین مهم:
۱. فقط و فقط یک پاراگراف اصلی و گیرا بنویس.
۲. از ایموجی‌های مرتبط به شکل هوشمندانه استفاده کن.
۳. در خط آخر حتماً ۴ تا ۶ هشتگ مرتبط قرار بده.
۴. هیچ متن اضافی یا توضیحی قبل و بعد کپشن ننویس.

متن مرجع:
${text.slice(0, 3000)}`

    // فراخوانی مستقیم Google Generative Language API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 600,
        }
      })
    })

    const data = await response.json()

    if (!response.ok) {
      const errMsg = data?.error?.message || 'خطا در ارتباط با مدل هوش مصنوعی'
      return NextResponse.json({ error: errMsg }, { status: 500 })
    }

    const caption = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!caption) {
      return NextResponse.json({ error: 'خروجی از هوش مصنوعی دریافت نشد' }, { status: 500 })
    }

    return NextResponse.json({ caption: caption.trim() })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'خطای غیرمنتظره سرور' }, { status: 500 })
  }
}
