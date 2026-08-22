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

    // ارسال پیام به کانال تلگرام
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const channelId = process.env.TELEGRAM_CHANNEL_ID

    if (botToken && channelId) {
      try {
        const messageText = `🆕 *پرامپت جدید ارسال شد*\n\n` +
          `*عنوان:* ${title}\n` +
          `*ایمیل فرستنده:* ${email || 'ثبت نشده'}\n\n` +
          `*متن پرامپت:*\n\`\`\`\n${prompt}\n\`\`\``

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: channelId,
            text: messageText,
            parse_mode: 'Markdown',
          }),
        })
      } catch (tgError) {
        console.error('Telegram notification failed:', tgError)
      }
    }

    return NextResponse.json({ ok: true, message: 'پرامپت با موفقیت ارسال شد' })
  } catch (error) {
    console.error('Submit prompt error:', error)
    return NextResponse.json({ error: 'خطا در ذخیره پرامپت' }, { status: 500 })
  }
}
