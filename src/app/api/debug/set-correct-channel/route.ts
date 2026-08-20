import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'No Telegram token' }, { status: 500 })

  // Channel name provided by user
  const channelName = 'انبار پرامپت' // Private channel
  
  const api = (m: string, q?: Record<string, string>) =>
    'https://api.telegram.org/bot' + token + '/' + m + (q ? '?' + new URLSearchParams(q).toString() : '')

  try {
    // Try to get channel info
    const chatRes = await fetch(api('getChat', { chat_id: '@' + channelName }), {
      signal: AbortSignal.timeout(10000),
    })
    const chatResult = await chatRes.json()

    if (!chatResult.ok) {
      return NextResponse.json({
        ok: false,
        error: chatResult.description,
        hint: 'ربات باید ادمین کانال باشد. برای کانال خصوصی، باید از chat_id عددی استفاده کنید (مثلاً -100xxxxxxxxxx)',
      })
    }

    const chat = chatResult.result
    const channelId = chat.id
    const channelType = chat.type

    // Save to settings
    await prisma.setting.upsert({
      where: { key: 'tg_chat_id' },
      update: { value: String(channelId) },
      create: { key: 'tg_chat_id', value: String(channelId) },
    })

    await prisma.setting.upsert({
      where: { key: 'tg_channel_name' },
      update: { value: channelName },
      create: { key: 'tg_channel_name', value: channelName },
    })

    return NextResponse.json({
      ok: true,
      channel: {
        id: channelId,
        name: channelName,
        type: channelType,
        username: chat.username,
      },
      message: 'کانال "انبار پرامپت" در تنظیمات ذخیره شد',
      note: channelType === 'privatechannel' 
        ? 'این یک کانال خصوصی است. برای دسترسی، ربات باید ادمین باشد و از chat_id عددی استفاده شود.'
        : 'کانال عمومی است',
    })

  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message,
      hint: 'برای کانال‌های خصوصی، باید chat_id عددی را دستی وارد کنید (مثلاً -1001234567890)',
    })
  }
}
