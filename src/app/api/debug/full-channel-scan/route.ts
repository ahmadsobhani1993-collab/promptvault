import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startId = parseInt(searchParams.get('start') || '1')
  const endId = parseInt(searchParams.get('end') || '1884')
  const dryRun = searchParams.get('dry') === 'true'

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 500 })

  const api = (m: string, q?: Record<string, string>) =>
    'https://api.telegram.org/bot' + token + '/' + m + (q ? '?' + new URLSearchParams(q).toString() : '')

  const chatId = await (await prisma.setting.findUnique({ where: { key: 'tg_chat_id' } }))?.value
  const priv = await (await prisma.setting.findUnique({ where: { key: 'tg_private_chat' } }))?.value

  if (!chatId || !priv) return NextResponse.json({ error: 'Chat IDs not set' }, { status: 500 })

  // Get all existing tg- slugs
  const existingPrompts = await prisma.prompt.findMany({
    where: { slug: { startsWith: 'tg-' } },
    select: { slug: true },
  })
  
  const existingIds = new Set(
    existingPrompts.map(p => {
      const idStr = p.slug.replace('tg-', '')
      const id = parseInt(idStr)
      return isNaN(id) ? null : id
    }).filter(Boolean) as number[]
  )

  const newPrompts: any[] = []
  const alreadyImported: number[] = []
  const noPhoto: number[] = []
  const forwardFailed: number[] = []

  let checked = 0
  const maxCheck = 200 // Limit to prevent timeout

  for (let i = startId; i <= endId && checked < maxCheck; i++) {
    checked++

    // Skip if already in DB
    if (existingIds.has(i)) {
      alreadyImported.push(i)
      continue
    }

    // Try to forward
    const f1 = await (await fetch(api('forwardMessage', { 
      chat_id: priv, 
      from_chat_id: chatId, 
      message_id: String(i) 
    }), { signal: AbortSignal.timeout(5000) })).json()

    if (!f1.ok) {
      forwardFailed.push(i)
      continue
    }

    const m1 = f1.result
    const hasPhoto = !!m1.photo?.length
    const text = (m1.caption || m1.text || '').trim()
    const hasText = text.length > 20
    const isReply = !!m1.reply_to_message

    // Check if valid prompt
    if (hasPhoto && (hasText || isReply)) {
      newPrompts.push({
        messageId: i,
        hasPhoto: true,
        textPreview: text.slice(0, 100),
        isReply: isReply,
      })
    } else {
      noPhoto.push(i)
    }

    // Cleanup
    await fetch(api('deleteMessage', { chat_id: priv, message_id: String(m1.message_id) })).catch(() => {})
  }

  const totalInChannel = endId - startId + 1
  const totalChecked = checked
  const remainingToCheck = totalInChannel - totalChecked

  return NextResponse.json({
    ok: true,
    scan: {
      range: { start: startId, end: endId },
      totalInChannel: totalInChannel,
      checked: totalChecked,
      remaining: remainingToCheck,
    },
    results: {
      alreadyImported: alreadyImported.length,
      newPromptsFound: newPrompts.length,
      noPhoto: noPhoto.length,
      forwardFailed: forwardFailed.length,
    },
    newPrompts: newPrompts.slice(0, 20), // Show first 20
    summary: {
      totalPromptsInDB: existingPrompts.length,
      newPromptsToImport: newPrompts.length,
      estimatedNetworkMB: (totalChecked * 0.002).toFixed(2),
    },
    nextStep: remainingToCheck > 0 
      ? `ادامه اسکن از ${startId + totalChecked}: ?start=${startId + totalChecked}&end=${endId}`
      : `اسکن کامل شد. ${newPrompts.length} پرامپت جدید پیدا شد.`,
    importCommand: newPrompts.length > 0
      ? `تنظیم import_cursor روی ${newPrompts[0].messageId} و اجرای import-loop`
      : null,
  })
}
