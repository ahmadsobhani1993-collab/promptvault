import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'Please provide ?slug=tg-XXXX' }, { status: 400 })
  }

  const prompt = await prisma.prompt.findUnique({ where: { slug } })
  if (!prompt) {
    return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
  }

  // Check if it has an image
  if (prompt.img) {
    return NextResponse.json({
      ok: true,
      message: 'This prompt already has an image',
      imageUrl: prompt.img,
    })
  }

  // Try to get image from Telegram
  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'No Telegram token' }, { status: 500 })
  }

  const api = (m: string, q?: Record<string, string>) =>
    'https://api.telegram.org/bot' + token + '/' + m + (q ? '?' + new URLSearchParams(q).toString() : '')

  const messageId = parseInt(slug.replace('tg-', ''))
  const chatId = (await prisma.setting.findUnique({ where: { key: 'tg_chat_id' } }))?.value
  const priv = (await prisma.setting.findUnique({ where: { key: 'tg_private_chat' } }))?.value

  if (!chatId || !priv) {
    return NextResponse.json({ error: 'Chat IDs not configured' }, { status: 500 })
  }

  try {
    // Forward message
    const f1 = await (await fetch(api('forwardMessage', {
      chat_id: priv,
      from_chat_id: chatId,
      message_id: String(messageId)
    }), { signal: AbortSignal.timeout(10000) })).json()

    if (!f1.ok) {
      return NextResponse.json({ error: 'Failed to forward message', details: f1 }, { status: 500 })
    }

    const m1 = f1.result
    const fileId = m1.photo?.length ? m1.photo[m1.photo.length - 1].file_id : null

    if (!fileId) {
      return NextResponse.json({ error: 'No photo in message' }, { status: 400 })
    }

    // Get file path
    const fr = await (await fetch(api('getFile', { file_id: fileId }), { signal: AbortSignal.timeout(10000) })).json()
    if (!fr.result?.file_path) {
      return NextResponse.json({ error: 'Failed to get file path' }, { status: 500 })
    }

    const imgUrl = 'https://api.telegram.org/file/bot' + token + '/' + fr.result.file_path

    // Update prompt
    await prisma.prompt.update({
      where: { id: prompt.id },
      data: { img: imgUrl },
    })

    // Clean up forwarded message
    await fetch(api('deleteMessage', { chat_id: priv, message_id: String(m1.message_id) })).catch(() => {})

    return NextResponse.json({
      ok: true,
      message: 'Image fixed!',
      imageUrl: imgUrl,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
