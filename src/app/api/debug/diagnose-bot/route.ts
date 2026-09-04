import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const token = process.env.TELEGRAM_BOT_TOKEN!
  const channelId = '-1003790089817'
  const channelUser = 'promptsfa1'

  // 1. اطلاعات bot
  const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then(r => r.json())

  // 2. وضعیت bot در کانال
  const member = await fetch(
    `https://api.telegram.org/bot${token}/getChatMember?chat_id=${channelId}&user_id=${me.result.id}`
  ).then(r => r.json())

  // 3. تست forward پست قدیمی (که قبلاً کار می‌کرد)
  const oldPost = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=@${channelUser}`).then(r => r.json())

  // 4. تست scraping یک پست جدید
  const scrape689 = await fetch('https://t.me/s/promptsfa1/689').then(r => r.text()).catch(() => 'failed')
  const scrape800 = await fetch('https://t.me/s/promptsfa1/800').then(r => r.text()).catch(() => 'failed')

  return NextResponse.json({
    bot: {
      id: me.result.id,
      username: me.result.username,
    },
    bot_in_channel: {
      status: member.result?.status,
      is_anonymous: member.result?.is_anonymous,
      can_post_messages: member.result?.can_post_messages,
      error: member.description,
    },
    channel: oldPost.ok ? {
      id: oldPost.result.id,
      title: oldPost.result.title,
    } : { error: oldPost.description },
    scraping: {
      msg689_visible: scrape689.includes('tgme_widget_message'),
      msg800_visible: scrape800.includes('tgme_widget_message'),
    },
    diagnosis: member.result?.status === 'administrator'
      ? '✅ Bot ادمین است — مشکل از پیام‌هاست'
      : member.result?.status === 'left' || member.result?.status === 'kicked'
      ? '❌ Bot از کانال خارج شده!'
      : `⚠️ وضعیت bot: ${member.result?.status || 'unknown'}`,
  })
}
