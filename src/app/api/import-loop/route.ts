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
  // همیشه از @promptsfa1 استفاده کن، صرف‌نظر از تنظیمات قبلی
const TARGET_CHANNEL = '@promptsfa1'
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
      error: 'Bot must be admin in ' + TARGET_CHANNEL,
      details: chatData.description 
    }, { status: 400 })
  }
} else {
  // اگر chatId قبلاً تنظیم شده، بررسی کن که آیا همان کانال جدید است
  debug.push('Using existing chatId: ' + chatId + ' (Verify it\'s @promptsfa1)')
}

  let privChat = await getSetting('tg_private_chat', '')
  if (!privChat) {
    return NextResponse.json({ error: 'Please send /start to the bot in private chat first.' }, { status: 400 })
  }

  let cursor = parseInt(await getSetting('import_cursor_msg_id', '2'), 10) // شروع از ۲
  let consecutiveFailures = parseInt(await getSetting('import_failures', '0'), 10)
  let successCount = 0
  let currentRetry = 0

  const categories = await prisma.category.findMany()
  debug.push(`🚀 Starting import from message ID: ${cursor}`)

  while (successCount < MAX_PHOTOS_PER_RUN && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
    debug.push(`\n--- Checking Message ID: ${cursor} ---`)

    // 1. Forward پیام جاری
    const fwdRes = await fetch(api('forwardMessage', { chat_id: privChat, from_chat_id: chatId, message_id: String(cursor) }))
    const fwdData = await fwdRes.json()

    if (!fwdData.ok) {
      debug.push(`❌ Forward failed: ${fwdData.description}`)
      consecutiveFailures++
      currentRetry++
      if (currentRetry >= MAX_CONSECUTIVE_FAILURES) break
      cursor++
      continue
    }

    consecutiveFailures = 0
    currentRetry = 0
    const msg = fwdData.result
    const fwdMsgId = msg.message_id
    const msgsToDelete: number[] = [fwdMsgId]

    let photoMsgId = cursor
    let textMsgId = cursor
    let text = (msg.caption || msg.text || '').trim()
    let hasPhoto = !!msg.photo

    // 2. منطق هوشمند پیدا کردن جفت عکس و متن
    if (hasPhoto && !text) {
      // حالت الف: عکس هست، متن نیست. چک کردن پیام بعدی (N+1)
      debug.push(`🔍 Photo found, no caption. Checking next message (${cursor + 1})...`)
      const nextRes = await fetch(api('forwardMessage', { chat_id: privChat, from_chat_id: chatId, message_id: String(cursor + 1) }))
      const nextData = await nextRes.json()
      
      if (nextData.ok) {
        const nextMsg = nextData.result
        msgsToDelete.push(nextMsg.message_id)
        const nextText = (nextMsg.text || nextMsg.caption || '').trim()
        
        // اگر پیام بعدی متن داشت و عکس نداشت، احتمالاً پرامپت همین عکس است
        if (nextText.length > 20 && !nextMsg.photo) {
          text = nextText
          textMsgId = cursor + 1
          debug.push(`✅ Found text in next message (ID: ${cursor + 1})`)
        }
      }
    } else if (!hasPhoto && text && text.length > 20) {
      // حالت ب: متن هست، عکس نیست. چک کردن پیام بعدی (N+1) برای عکس
      debug.push(`🔍 Text found, no photo. Checking next message (${cursor + 1}) for photo...`)
      const nextRes = await fetch(api('forwardMessage', { chat_id: privChat, from_chat_id: chatId, message_id: String(cursor + 1) }))
      const nextData = await nextRes.json()
      
      if (nextData.ok && nextData.result.photo) {
        hasPhoto = true
        photoMsgId = cursor + 1
        // ما پیام عکس را هم forward کردیم، پس باید آن را هم پاک کنیم
        // اما صبر کنید، ما فقط متن را forward کردیم. برای گرفتن file_id عکس، باید پیام عکس را هم forward کنیم
        // پس یک forward دیگر برای عکس می‌زنیم
        const photoRes = await fetch(api('forwardMessage', { chat_id: privChat, from_chat_id: chatId, message_id: String(cursor + 1) }))
        const photoData = await photoRes.json()
        if (photoData.ok) {
           msgsToDelete.push(photoData.result.message_id)
        }
        debug.push(`✅ Found photo in next message (ID: ${cursor + 1})`)
      }
    }

    // اگر هنوز عکس یا متن پیدا نشد، رد شو
    if (!hasPhoto || !text) {
      debug.push(`⏭️ Skip: No valid photo+text pair found at ID ${cursor}`)
      for (const id of msgsToDelete) {
        await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(id) })).catch(() => {})
      }
      cursor++
      continue
    }

    // 3. گرفتن عکس از پیامی که واقعاً عکس دارد (photoMsgId)
    const photoFwdRes = await fetch(api('forwardMessage', { chat_id: privChat, from_chat_id: chatId, message_id: String(photoMsgId) }))
    const photoFwdData = await photoFwdRes.json()
    
    if (!photoFwdData.ok || !photoFwdData.result.photo) {
      debug.push(`❌ Could not get photo from ID ${photoMsgId}`)
      for (const id of msgsToDelete) {
        await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(id) })).catch(() => {})
      }
      cursor = Math.max(cursor + 1, photoMsgId + 1)
      continue
    }
    
    msgsToDelete.push(photoFwdData.result.message_id)
    const fileId = photoFwdData.result.photo[photoFwdData.result.photo.length - 1].file_id
    
    const fileRes = await fetch(api('getFile', { file_id: fileId }))
    const fileData = await fileRes.json()
    
    // پاکسازی پیام‌های فوروارد شده از چت خصوصی
    for (const id of msgsToDelete) {
      await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(id) })).catch(() => {})
    }

    if (!fileData.ok || !fileData.result?.file_path) {
      debug.push(`❌ Skip: Could not get file_path`)
      cursor = Math.max(cursor + 1, photoMsgId + 1)
      continue
    }

    const imgUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`

    // 4. ارسال به جمینای و ذخیره
    try {
      debug.push(`🤖 Sending to Gemini...`)
      const ai = await analyzeWithGemini({ text, categories })
      
      const cat = await prisma.category.findUnique({ where: { slug: ai.categorySlug } })
      const finalPrompt = (ai.promptEn || text).trim()

      // چک کردن تکراری بودن
      const existing = await prisma.prompt.findUnique({ where: { slug: `tg-${photoMsgId}` } })
      if (existing) {
        debug.push(`⏭️ Skip: Already exists (tg-${photoMsgId})`)
        cursor = Math.max(cursor + 1, photoMsgId + 1)
        continue
      }

      await prisma.prompt.create({
        data: {
          titleFa: ai.titleFa,
          titleEn: ai.titleEn,
          descFa: ai.descFa,
          descEn: ai.descEn,
          usageFa: ai.usageFa,
          usageEn: ai.usageEn,
          slug: `tg-${photoMsgId}`,
          img: imgUrl,
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

      results.push({ id: photoMsgId, slug: `tg-${photoMsgId}`, title: ai.titleFa })
      successCount++
      debug.push(`✅ Successfully imported: ${ai.titleFa}`)
      
      cursor = Math.max(cursor + 1, photoMsgId + 1)

    } catch (e: any) {
      const errMsg = String(e?.message ?? e)
      debug.push(`❌ Error for ID ${photoMsgId}: ${errMsg}`)
      currentRetry++
      if (currentRetry >= MAX_CONSECUTIVE_FAILURES) {
        cursor = Math.max(cursor + 1, photoMsgId + 1)
        currentRetry = 0
      }
    }
  }

  await setSetting('import_cursor_msg_id', String(cursor))
  await setSetting('import_failures', String(consecutiveFailures))

  return NextResponse.json({ ok: true, summary: { processed_up_to: cursor, success_count: successCount }, results, debug })
}
