'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function tags(str: string) {
  return ((str as string) || '').split(/[,،]/).map((t) => t.trim()).filter(Boolean)
}

export async function createSubmit(fd: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const titleFa = fd.get('titleFa') as string
  const titleEn = (fd.get('titleEn') as string) || titleFa
  const prompt = fd.get('prompt') as string
  const email = session.user.email || 'ثبت نشده'

  await prisma.prompt.create({
    data: {
      titleFa,
      titleEn,
      slug: slugify(titleEn) + '-' + Date.now().toString(36),
      img: fd.get('img') as string,
      model: fd.get('model') as string,
      type: (fd.get('type') as string) as any,
      categoryId: fd.get('categoryId') as string,
      subId: (fd.get('subId') as string) || null,
      tagsFa: tags(fd.get('tagsFa') as string),
      tagsEn: tags(fd.get('tagsEn') as string),
      prompt,
      usageFa: (fd.get('usageFa') as string) || null,
      usageEn: (fd.get('usageEn') as string) || null,
      status: 'PENDING',
      userId: session.user.id,
    },
  })

  // ارسال پیام به کانال تلگرام
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const channelId = process.env.TELEGRAM_CHANNEL_ID

  if (botToken && channelId) {
    try {
      const messageText = `🆕 *پرامپت جدید ارسال شد*\n\n` +
        `*عنوان:* ${titleFa}\n` +
        `*ایمیل فرستنده:* ${email}\n\n` +
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

  revalidatePath('/', 'layout')
  redirect('/submit?done=1')
}
