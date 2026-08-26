import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60

async function getSetting(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'No TELEGRAM_BOT_TOKEN' }, { status: 500 })

  const api = (method: string, params?: Record<string, string>) =>
    `https://api.telegram.org/bot${token}/${method}${params ? '?' + new URLSearchParams(params).toString() : ''}`

  const debug: any[] = []
  const chatId = await getSetting('tg_chat_id', '')
  
  if (!chatId) {
    return NextResponse.json({ error: 'tg_chat_id not set. Run import-loop first.' }, { status: 400 })
  }

  // بررسی ۲۰ پیام آخر کانال
  const limit = 20
  debug.push(` Checking last ${limit} messages from channel ${chatId}...`)

  // دریافت پیام‌ها از طریق forward به چت خصوصی
  const privChat = await getSetting('tg_private_chat', '')
  if (!privChat) {
    return NextResponse.json({ error: 'tg_private_chat not set. Send /start to bot first.' }, { status: 400 })
  }

  // گرفتن آخرین message_id از تنظیمات
  const lastCursor = parseInt(await getSetting('import_cursor_msg_id', '1'), 10)
  debug.push(`📍 Last processed message ID: ${lastCursor}`)

  // بررسی ۲۰ پیام بعدی
  for (let i = 0; i < limit; i++) {
    const msgId = lastCursor + i
    const log: any = { messageId: msgId }

    try {
      // Forward پیام به چت خصوصی
      const fwdRes = await fetch(api('forwardMessage', {
        chat_id: privChat,
        from_chat_id: chatId,
        message_id: String(msgId)
      }))
      const fwdData = await fwdRes.json()

      if (!fwdData.ok) {
        log.status = '❌ Forward failed'
        log.error = fwdData.description
        debug.push(log)
        continue
      }

      const msg = fwdData.result
      log.hasPhoto = !!msg.photo
      log.hasCaption = !!msg.caption
      log.hasText = !!msg.text
      log.captionLength = msg.caption?.length || 0
      log.textLength = msg.text?.length || 0

      // بررسی ریپلای
      if (!msg.caption && !msg.text) {
        log.checkingReply = true
        const nextMsgId = msgId + 1
        const nextFwdRes = await fetch(api('forwardMessage', {
          chat_id: privChat,
          from_chat_id: chatId,
          message_id: String(nextMsgId)
        }))
        const nextFwdData = await nextFwdRes.json()
        
        if (nextFwdData.ok) {
          const nextMsg = nextFwdData.result
          log.nextMessageId = nextMsgId
          log.nextIsReply = nextMsg.reply_to_message?.message_id === msgId
          log.nextHasText = !!(nextMsg.text || nextMsg.caption)
          log.nextTextLength = (nextMsg.text || nextMsg.caption || '').length
        }
        
        // پاک کردن پیام forward شده
        await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(nextFwdData.result.message_id) })).catch(() => {})
      }

      // بررسی وجود در دیتابیس
      const existing = await prisma.prompt.findUnique({ where: { slug: `tg-${msgId}` } })
      log.inDatabase = !!existing
      log.databaseSlug = existing?.slug || null

      // پاک کردن پیام forward شده
      await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(msg.message_id) })).catch(() => {})

      log.status = '✅ OK'
      debug.push(log)

    } catch (e: any) {
      log.status = '❌ Error'
      log.error = e.message
      debug.push(log)
    }
  }

  // بررسی وضعیت دیتابیس
  const totalPrompts = await prisma.prompt.count()
  const tgPrompts = await prisma.prompt.count({ where: { slug: { startsWith: 'tg-' } } })
  
  debug.push({
    summary: {
      totalPromptsInDB: totalPrompts,
      telegramImportedPrompts: tgPrompts,
      lastCursor: lastCursor,
      nextToProcess: lastCursor + limit
    }
  })

  return NextResponse.json({ ok: true, debug })
}
