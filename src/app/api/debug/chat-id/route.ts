import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })

  try {
    const updates = await (await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?limit=50`,
      { signal: AbortSignal.timeout(10000) }
    )).json()

    const chats: any[] = []
    for (const u of updates.result || []) {
      if (u.message?.chat) {
        chats.push({
          id: u.message.chat.id,
          type: u.message.chat.type,
          username: u.message.chat.username,
          title: u.message.chat.title,
          lastMessage: u.message.text?.slice(0, 50),
        })
      }
    }

    // Save the first private chat
    const privateChat = chats.find(c => c.type === 'private')
    if (privateChat) {
      await prisma.setting.upsert({
        where: { key: 'tg_private_chat' },
        update: { value: String(privateChat.id) },
        create: { key: 'tg_private_chat', value: String(privateChat.id) },
      })
    }

    return NextResponse.json({
      ok: true,
      chats,
      savedPrivateChat: privateChat?.id || null,
      hint: 'اگر می‌خواهید chat_id ذخیره شود، اول به ربات تلگرام پیام /start بفرستید',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
