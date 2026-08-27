import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

async function getSetting(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 500 })
  
  const api = (method: string, params?: Record<string, string>) =>
    `https://api.telegram.org/bot${token}/${method}${params ? '?' + new URLSearchParams(params).toString() : ''}`

  const chatId = await getSetting('tg_chat_id', '')
  const privChat = await getSetting('tg_private_chat', '')
  
  if (!chatId || !privChat) {
    return NextResponse.json({ error: 'Settings not configured' }, { status: 400 })
  }

  const debug: any[] = []
  const MAX_MSG = 956 // اسکن تا آخرین پیام کانال
  
  let hasPhoto = 0
  let alreadyImported = 0
  let noPhoto = 0
  let noPrompt = 0
  let validForImport = 0

  for (let msgId = 2; msgId <= MAX_MSG; msgId++) {
    try {
      const fwdRes = await fetch(api('forwardMessage', { 
        chat_id: privChat,
        from_chat_id: chatId, 
        message_id: String(msgId) 
      }))
      
      if (!fwdRes.ok) continue
      
      const fwdData = await fwdRes.json()
      if (!fwdData.ok) continue
      
      const msg = fwdData.result
      
      // پاک کردن پیام فوروارد شده
      await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(msg.message_id) })).catch(() => {})

      if (!msg.photo) {
        noPhoto++
        continue
      }

      hasPhoto++
      
      const caption = (msg.caption || '').trim()
      const existing = await prisma.prompt.findUnique({ where: { slug: `tg-${msgId}` } })
      
      if (existing) {
        alreadyImported++
        continue
      }

      // بررسی اینکه آیا پرامپت معتبر دارد
      let hasValidPrompt = false
      if (caption.length > 50) {
        hasValidPrompt = true
      } else {
        // چک کردن پیام بعدی
        const nextRes = await fetch(api('forwardMessage', { 
          chat_id: privChat,
          from_chat_id: chatId, 
          message_id: String(msgId + 1) 
        }))
        
        if (nextRes.ok) {
          const nextData = await nextRes.json()
          if (nextData.ok) {
            const nextText = (nextData.result.text || nextData.result.caption || '').trim()
            if (nextText.length > 50 && !nextData.result.photo) {
              hasValidPrompt = true
            }
            await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(nextData.result.message_id) })).catch(() => {})
          }
        }
      }

      if (hasValidPrompt) {
        validForImport++
        debug.push({ msgId, status: 'READY_TO_IMPORT', captionLength: caption.length })
      } else {
        noPrompt++
      }

    } catch (e) {
      // skip
    }
  }

  return NextResponse.json({
    summary: {
      totalScanned: MAX_MSG,
      hasPhoto,
      alreadyImported,
      noPhoto,
      noPrompt,
      validForImport,
    },
    readyToImport: debug.slice(0, 50), // فقط 50 تای اول
  })
}
