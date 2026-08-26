import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

async function setSetting(k: string, v: string) {
  await prisma.setting.upsert({ 
    where: { key: k }, 
    update: { value: v }, 
    create: { key: k, value: v } 
  })
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 500 })

  const api = (method: string, params?: Record<string, string>) =>
    `https://api.telegram.org/bot${token}/${method}${params ? '?' + new URLSearchParams(params).toString() : ''}`

  // گرفتن ID عددی کانال @promptsfa1
  const chatRes = await fetch(api('getChat', { chat_id: '@promptsfa1' }))
  const chatData = await chatRes.json()

  if (!chatData.ok) {
    return NextResponse.json({ 
      error: 'Bot is not admin in @promptsfa1', 
      details: chatData.description 
    }, { status: 400 })
  }

  const newChatId = String(chatData.result.id)
  
  // ذخیره در دیتابیس
  await setSetting('tg_chat_id', newChatId)
  await setSetting('import_cursor_msg_id', '2')
  await setSetting('import_failures', '0')

  return NextResponse.json({
    ok: true,
    message: 'Channel reset to @promptsfa1',
    newChatId: newChatId,
    channelTitle: chatData.result.title,
    cursor: 2
  })
}
