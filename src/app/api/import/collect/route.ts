import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60

async function getSetting(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}
async function setSetting(k: string, v: string) {
  await prisma.setting.upsert({ where: { key: k }, update: { value: v }, create: { key: k, value: v } })
}

const CAPTION_THRESHOLD = 100

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const q = new URL(req.url).searchParams
  const count = Math.min(5, parseInt(q.get('count') || '3', 10))

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })
  const api = (m: string, p?: Record<string, string>) =>
    `https://api.telegram.org/bot${token}/${m}${p ? '?' + new URLSearchParams(p) : ''}`

  const channelUser = 'promptsfa1'

  let chatId = await getSetting('tg_channel_chat_id', '')
  if (!chatId) {
    const c = await (await fetch(api('getChat', { chat_id: '@' + channelUser }))).json()
    if (!c.ok) return NextResponse.json({ error: 'getChat failed: ' + c.description }, { status: 500 })
    chatId = String(c.result.id)
    await setSetting('tg_channel_chat_id', chatId)
  }

  const privChat = await getSetting('tg_private_chat', '')
  if (!privChat) return NextResponse.json({ error: 'send /start to bot' }, { status: 400 })

  let cursor = parseInt(await getSetting('import_cursor2', '2'), 10)
  const collected: any[] = []
  let processed = 0
  let consecutiveEmpty = 0

  for (let msgId = cursor; collected.length < count && processed < 100; msgId++, processed++) {
    const f1 = await (await fetch(api('forwardMessage', {
      chat_id: privChat, from_chat_id: chatId, message_id: String(msgId)
    }))).json()

    if (!f1.ok) {
      if (f1.description?.includes('MESSAGE_ID_INVALID') || f1.description?.includes('message not found')) {
        consecutiveEmpty++
        if (consecutiveEmpty > 20) break
        continue
      }
      consecutiveEmpty++
      continue
    }

    consecutiveEmpty = 0

    if (!f1.result?.photo && !f1.result?.video) {
      // پیام متنی یا نوع دیگر — skip
      continue
    }

    const photoMsg = f1.result
    const fwd1 = photoMsg.message_id
    const caption = (photoMsg.caption || '').trim()

    let promptText = ''
    let fwd2: number | null = null

    if (caption.length <= CAPTION_THRESHOLD) {
      const f2 = await (await fetch(api('forwardMessage', {
        chat_id: privChat, from_chat_id: chatId, message_id: String(msgId + 1)
      }))).json()

      if (f2.ok && f2.result) {
        const nm = f2.result
        fwd2 = nm.message_id
        const isReply = nm.reply_to_message?.message_id === msgId
        const txt = (nm.text || nm.caption || '').trim()

        if (isReply || (!nm.photo && !nm.video && txt.length > 100)) {
          promptText = txt
        }
      }
    } else {
      promptText = caption
    }

    for (const id of [fwd1, fwd2]) if (id) await fetch(api('deleteMessage', {
      chat_id: privChat, message_id: String(id)
    })).catch(() => {})

    if (promptText.length < 20) continue

    const fileId = photoMsg.photo
      ? photoMsg.photo[photoMsg.photo.length - 1].file_id
      : photoMsg.video[photoMsg.video.length - 1].file_id

    await prisma.telegramQueue.upsert({
      where: { id: msgId },
      update: { text: promptText, img: fileId, status: 'PENDING' },
      create: { id: msgId, text: promptText, img: fileId, status: 'PENDING' },
    })

    collected.push({
      msgId,
      captionLen: caption.length,
      source: caption.length <= CAPTION_THRESHOLD ? 'reply' : 'caption',
      preview: promptText.slice(0, 80),
    })
  }

  await setSetting('import_cursor2', String(cursor + processed))

  return NextResponse.json({
    ok: true,
    collected: collected.length,
    nextCursor: cursor + processed,
    processed,
    items: collected,
  })
}
