import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startId = parseInt(searchParams.get('start') || '1')
  const endId = parseInt(searchParams.get('end') || '3660')
  const sampleSize = parseInt(searchParams.get('sample') || '50')

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })
  
  const api = (m: string, q?: Record<string, string>) =>
    'https://api.telegram.org/bot' + token + '/' + m + (q ? '?' + new URLSearchParams(q).toString() : '')

  // Get already imported IDs
  const existingPrompts = await prisma.prompt.findMany({
    where: { slug: { startsWith: 'tg-' } },
    select: { slug: true },
  })
  
  const importedIds = new Set(
    existingPrompts.map(p => {
      const idStr = p.slug.replace('tg-', '')
      const id = parseInt(idStr)
      return isNaN(id) ? null : id
    }).filter(Boolean) as number[]
  )

  // Get chat IDs
  let chatId = (await prisma.setting.findUnique({ where: { key: 'tg_chat_id' } }))?.value ?? ''
  let priv = (await prisma.setting.findUnique({ where: { key: 'tg_private_chat' } }))?.value ?? ''

  if (!chatId || !priv) {
    return NextResponse.json({ error: 'chat IDs not configured' }, { status: 500 })
  }

  // Scan a sample of messages
  const scanResults: any[] = []
  const step = Math.max(1, Math.floor((endId - startId) / sampleSize))
  
  let hasPhoto = 0
  let hasText = 0
  let both = 0
  let reply = 0
  let importable = 0

  for (let id = startId; id <= endId && scanResults.length < sampleSize; id += step) {
    if (importedIds.has(id)) continue

    try {
      // Forward message to private chat
      const f1 = await (await fetch(api('forwardMessage', { 
        chat_id: priv, 
        from_chat_id: chatId, 
        message_id: String(id) 
      }), { signal: AbortSignal.timeout(5000) })).json()

      if (!f1.ok) continue

      const m1 = f1.result
      const hasPhotoField = !!m1.photo?.length
      const text = (m1.caption || m1.text || '').trim()
      const hasTextField = text.length > 10
      const isReply = !!m1.reply_to_message

      if (hasPhotoField) hasPhoto++
      if (hasTextField) hasText++
      if (hasPhotoField && hasTextField) both++
      if (isReply) reply++

      // Check if importable (has photo and text, or photo with reply)
      if (hasPhotoField && (hasTextField || isReply)) {
        importable++
      }

      scanResults.push({
        id,
        hasPhoto: hasPhotoField,
        hasText: hasTextField,
        textLength: text.length,
        isReply,
        importable: hasPhotoField && (hasTextField || isReply),
      })

      // Delete forwarded message to keep private chat clean
      await fetch(api('deleteMessage', { 
        chat_id: priv, 
        message_id: String(m1.message_id) 
      })).catch(() => {})

    } catch (err) {
      // Skip on error
    }
  }

  // Estimate total importable
  const totalScanned = scanResults.length
  const importablePercentage = totalScanned > 0 ? (importable / totalScanned) : 0
  const estimatedTotalImportable = Math.floor((endId - startId - importedIds.size) * importablePercentage)

  // Calculate network cost
  const messagesToScan = endId - startId - importedIds.size
  const estimatedNetworkMB = (messagesToScan * 500 / 1024 / 1024).toFixed(2)

  return NextResponse.json({
    ok: true,
    scan: {
      sampleSize: totalScanned,
      hasPhoto,
      hasText,
      both,
      reply,
      importable,
      importablePercentage: (importablePercentage * 100).toFixed(1) + '%',
    },
    estimate: {
      totalMessagesToScan: messagesToScan,
      estimatedImportable: estimatedTotalImportable,
      estimatedNetworkMB,
      yourRemainingQuota: '600 MB',
      safe: parseFloat(estimatedNetworkMB) < 600,
    },
    sample: scanResults.slice(0, 10),
    nextStep: estimatedTotalImportable > 0 
      ? `برای ایمپورت ~${estimatedTotalImportable} پرامپت جدید، import-loop را اجرا کنید`
      : 'هیچ پرامپت جدیدی برای ایمپورت یافت نشد',
  })
}
