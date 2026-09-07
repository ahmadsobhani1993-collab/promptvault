import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const q = new URL(req.url).searchParams
  const start = parseInt(q.get('start') || '771', 10)
  const end = parseInt(q.get('end') || '790', 10)

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no TELEGRAM_BOT_TOKEN' }, { status: 500 })
  
  const chatId = (await prisma.setting.findUnique({ where: { key: 'tg_channel_chat_id' } }))?.value
  const privChat = (await prisma.setting.findUnique({ where: { key: 'tg_private_chat' } }))?.value
  
  if (!chatId) return NextResponse.json({ error: 'no tg_channel_chat_id' }, { status: 500 })
  if (!privChat) return NextResponse.json({ error: 'no tg_private_chat' }, { status: 500 })

  const results: any[] = []

  for (let msgId = start; msgId <= end; msgId++) {
    try {
      const slug = 'tg-' + msgId
      
      // 1. چک DB
      let inDb = false
      let dbStatus = null
      try {
        const p = await prisma.prompt.findUnique({ where: { slug } })
        inDb = !!p
        dbStatus = p?.status || null
      } catch (e: any) {
        results.push({ msgId, error: 'db_error: ' + e.message })
        continue
      }

      // 2. چک Telegram با forwardMessage
      let inTelegram = false
      let tgError = null
      try {
        const f = await fetch(
          `https://api.telegram.org/bot${token}/forwardMessage?chat_id=${privChat}&from_chat_id=${chatId}&message_id=${msgId}`,
          { signal: AbortSignal.timeout(10000) }
        )
        const j = await f.json()
        
        if (j.ok) {
          inTelegram = true
          // پاک کردن forwarded
          await fetch(
            `https://api.telegram.org/bot${token}/deleteMessage?chat_id=${privChat}&message_id=${j.result.message_id}`
          ).catch(() => {})
        } else {
          tgError = j.description?.slice(0, 60)
        }
      } catch (e: any) {
        tgError = 'fetch_error: ' + e.message
      }

      results.push({
        msgId,
        inDb,
        dbStatus,
        inTelegram,
        tgError,
        needImport: !inDb && inTelegram,
      })
    } catch (e: any) {
      results.push({ msgId, error: 'outer: ' + e.message })
    }
  }

  const needImport = results.filter(r => r.needImport)
  const inDbOnly = results.filter(r => r.inDb && !r.inTelegram)

  return NextResponse.json({
    ok: true,
    range: `${start}-${end}`,
    total: results.length,
    needImport: needImport.length,
    inDbOnly: inDbOnly.length,
    firstNeedImport: needImport[0]?.msgId || null,
    results,
  })
}
