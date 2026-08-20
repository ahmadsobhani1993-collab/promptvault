import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const batchSize = parseInt(searchParams.get('batch') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 500 })

  const api = (m: string, q?: Record<string, string>) =>
    'https://api.telegram.org/bot' + token + '/' + m + (q ? '?' + new URLSearchParams(q).toString() : '')

  const chatId = await (await prisma.setting.findUnique({ where: { key: 'tg_chat_id' } }))?.value
  const priv = await (await prisma.setting.findUnique({ where: { key: 'tg_private_chat' } }))?.value

  if (!chatId || !priv) return NextResponse.json({ error: 'Chat IDs not set' }, { status: 500 })

  // Find prompts that STILL have the old internal image links
  const oldPrompts = await prisma.prompt.findMany({
    where: {
      slug: { startsWith: 'tg-' },
      img: { contains: 'promptsfa.ir/api/img' } // Target old links
    },
    select: { id: true, slug: true, titleFa: true, img: true },
    take: batchSize,
    skip: offset,
    orderBy: { createdAt: 'asc' }
  })

  if (oldPrompts.length === 0) {
    return NextResponse.json({
      ok: true,
      message: '🎉 تبریک! تمام پرامپت‌ها با موفقیت به لینک مستقیم تلگرام مهاجرت کردند.',
      totalMigrated: offset,
    })
  }

  let successCount = 0
  let failCount = 0
  const logs: string[] = []

  for (const prompt of oldPrompts) {
    const messageId = prompt.slug.replace('tg-', '')
    
    try {
      // 1. Forward message to get fresh file_id
      const f1 = await (await fetch(api('forwardMessage', { 
        chat_id: priv, 
        from_chat_id: chatId, 
        message_id: messageId 
      }), { signal: AbortSignal.timeout(5000) })).json()

      if (!f1.ok || !f1.result?.photo?.length) {
        failCount++
        logs.push(`[${prompt.slug}] Failed to get photo`)
        continue
      }

      const fileId = f1.result.photo[f1.result.photo.length - 1].file_id

      // 2. Get file_path
      const fr = await (await fetch(api('getFile', { file_id: fileId }), { signal: AbortSignal.timeout(5000) })).json()
      
      if (fr.ok && fr.result?.file_path) {
        const newImgUrl = `https://api.telegram.org/file/bot${token}/${fr.result.file_path}`
        
        // 3. Update database (NO image download, just text update!)
        await prisma.prompt.update({
          where: { id: prompt.id },
          data: { img: newImgUrl }
        })
        successCount++
      } else {
        failCount++
      }

      // 4. Cleanup forwarded message
      await fetch(api('deleteMessage', { chat_id: priv, message_id: String(f1.result.message_id) })).catch(() => {})

    } catch (err) {
      failCount++
      logs.push(`[${prompt.slug}] Error`)
    }
  }

  const nextOffset = offset + batchSize

  return NextResponse.json({
    ok: true,
    batch: {
      processed: oldPrompts.length,
      success: successCount,
      failed: failCount,
    },
    progress: {
      currentOffset: offset,
      nextOffset,
      remainingEstimate: 'برای ادامه، offset را در لینک زیر به‌روز کنید',
    },
    nextUrl: `https://promptsfa.ir/api/debug/migrate-to-tg-links?key=pv-cron-8x2m1q&batch=${batchSize}&offset=${nextOffset}`,
    logs: logs.slice(0, 5), // Show first 5 logs
  })
}
