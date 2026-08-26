import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeWithGemini } from '@/lib/gemini'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'
const TARGET_CHANNEL = '@promptsfa1'
const MAX_PHOTOS_PER_RUN = 10
const MAX_CONSECUTIVE_FAILURES = 10

async function getSetting(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}

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
  if (!token) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 })
  
  const api = (method: string, params?: Record<string, string>) =>
    `https://api.telegram.org/bot${token}/${method}${params ? '?' + new URLSearchParams(params).toString() : ''}`

  const debug: string[] = []
  const results: any[] = []
  
  // 1. پیدا کردن یا دریافت ID عددی کانال
  let chatId = await getSetting('tg_chat_id', '')
  if (!chatId || chatId === 'auto') {
    debug.push('Resolving channel ID for ' + TARGET_CHANNEL + '...')
    const chatRes = await fetch(api('getChat', { chat_id: TARGET_CHANNEL }))
    const chatData = await chatRes.json()
    if (chatData.ok) {
      chatId = String(chatData.result.id)
      await setSetting('tg_chat_id', chatId)
      debug.push('✅ Channel ID resolved: ' + chatId)
    } else {
      return NextResponse.json({ 
        error: 'Bot must be an admin in ' + TARGET_CHANNEL + ' to read messages.',
        details: chatData.description 
      }, { status: 400 })
    }
  }

  // 2. دریافت یا تنظیم چت خصوصی برای Forward
  let privChat = await getSetting('tg_private_chat', '')
  if (!privChat) {
    debug.push('Waiting for /start in private chat...')
    const updates = await (await fetch(api('getUpdates', { limit: '10' }))).json()
    for (const u of updates.result ?? []) {
      if (u.message?.chat?.type === 'private') {
        privChat = String(u.message.chat.id)
        break
      }
    }
    if (!privChat) {
      return NextResponse.json({ error: 'Please send /start to the bot in a private chat first.' }, { status: 400 })
    }
    await setSetting('tg_private_chat', privChat)
    debug.push('✅ Private chat ID set: ' + privChat)
  }

  // 3. خواندن وضعیت Cursor و Retry
  let cursor = parseInt(await getSetting('import_cursor_msg_id', '1'), 10)
  let consecutiveFailures = parseInt(await getSetting('import_failures', '0'), 10)
  let successCount = 0
  let currentRetry = 0

  const categories = await prisma.category.findMany()

  debug.push(`🚀 Starting import from message ID: ${cursor}`)

  while (successCount < MAX_PHOTOS_PER_RUN && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
    debug.push(`\n--- Processing Message ID: ${cursor} (Retry: ${currentRetry}/${MAX_CONSECUTIVE_FAILURES}) ---`)

    // Forward message to private chat to read it
    const fwdRes = await fetch(api('forwardMessage', {
      chat_id: privChat,
      from_chat_id: chatId,
      message_id: String(cursor)
    }))
    const fwdData = await fwdRes.json()

    if (!fwdData.ok) {
      debug.push(`❌ Forward failed: ${fwdData.description}`)
      consecutiveFailures++
      currentRetry++
      
      if (currentRetry >= MAX_CONSECUTIVE_FAILURES) {
        debug.push(`🛑 Reached max consecutive failures (${MAX_CONSECUTIVE_FAILURES}). Stopping.`)
        break
      }
      cursor++ // Move to next message ID on failure
      continue
    }

    // Reset failures on successful forward
    consecutiveFailures = 0
    currentRetry = 0
    const msg = fwdData.result
    const fwdMsgId = msg.message_id

    // Check if it's a photo
    if (!msg.photo) {
      debug.push(`⏭️ Skip: Not a photo (ID: ${cursor})`)
      await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(fwdMsgId) })).catch(() => {})
      cursor++
      continue
    }

    // Extract text: Caption OR Reply
    let text = (msg.caption || msg.text || '').trim()
    let peekedReplyMsgId: number | null = null
    let advanceCursorBy = 1

    if (!text) {
      debug.push(`🔍 No caption found. Checking for reply at ID: ${cursor + 1}...`)
      const peekRes = await fetch(api('forwardMessage', {
        chat_id: privChat,
        from_chat_id: chatId,
        message_id: String(cursor + 1)
      }))
      const peekData = await peekRes.json()
      
      if (peekData.ok) {
        const peekMsg = peekData.result
        const peekFwdId = peekMsg.message_id
        
        // Check if this next message is a reply to our photo
        if (peekMsg.reply_to_message?.message_id === cursor) {
          text = (peekMsg.text || peekMsg.caption || '').trim()
          if (text) {
            debug.push(`✅ Found reply text!`)
            peekedReplyMsgId = peekFwdId
            advanceCursorBy = 2 // Skip the reply message in next iteration
          }
        }
        
        // Clean up peeked message
        await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(peekFwdId) })).catch(() => {})
      }
    }

    // Clean up the main forwarded photo message
    await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(fwdMsgId) })).catch(() => {})

    if (!text) {
      debug.push(`⏭️ Skip: Photo has no caption and no reply text (ID: ${cursor})`)
      cursor += advanceCursorBy
      continue
    }

    // Get Direct File URL (NO DOWNLOAD)
    const fileId = msg.photo[msg.photo.length - 1].file_id
    const fileRes = await fetch(api('getFile', { file_id: fileId }))
    const fileData = await fileRes.json()

    if (!fileData.ok || !fileData.result?.file_path) {
      debug.push(`❌ Skip: Could not get file_path for ID: ${cursor}`)
      cursor += advanceCursorBy
      continue
    }

    const imgUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`
    debug.push(`🖼️ Image URL generated: ${imgUrl.substring(0, 50)}...`)

    // Process with Gemini (TEXT ONLY)
    try {
      debug.push(`🤖 Sending to Gemini (Text Only)...`)
      const ai = await analyzeWithGemini({ text, categories })
      
      const cat = await prisma.category.findUnique({ where: { slug: ai.categorySlug } })
      const finalPrompt = (ai.promptEn || text).trim()

      const prompt = await prisma.prompt.create({
        data: {
          titleFa: ai.titleFa,
          titleEn: ai.titleEn,
          descFa: ai.descFa,
          descEn: ai.descEn,
          usageFa: ai.usageFa,
          usageEn: ai.usageEn,
          slug: `tg-${cursor}`,
          img: imgUrl, // Direct Telegram URL
          model: /--v\s?\d|--ar/.test(finalPrompt) ? 'Midjourney' : 'AI',
          type: 'IMAGE',
          status: 'PUBLISHED',
          categoryId: cat?.id ?? categories[0]?.id,
          tagsFa: ai.tagsFa,
          tagsEn: ai.tagsEn,
          prompt: finalPrompt,
          views: 1 + Math.floor(Math.random() * 10),
        },
      })

      results.push({ id: cursor, slug: prompt.slug, title: ai.titleFa })
      successCount++
      debug.push(`✅ Successfully imported: ${ai.titleFa}`)
      
      cursor += advanceCursorBy

    } catch (e: any) {
      const errMsg = String(e?.message ?? e)
      debug.push(`❌ Gemini/DB Error for ID ${cursor}: ${errMsg}`)
      
      // Do NOT increment cursor here, so it retries the same message next time
      currentRetry++
      if (currentRetry >= MAX_CONSECUTIVE_FAILURES) {
        debug.push(`🛑 Gave up on message ID ${cursor} after ${MAX_CONSECUTIVE_FAILURES} retries.`)
        cursor++ // Finally skip it
        currentRetry = 0
      }
    }
  }

  // Save state
  await setSetting('import_cursor_msg_id', String(cursor))
  await setSetting('import_failures', String(consecutiveFailures))

  return NextResponse.json({
    ok: true,
    summary: {
      processed_cursor: cursor,
      success_count: successCount,
      consecutive_failures: consecutiveFailures,
    },
    results,
    debug,
  })
}
