import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function POST(req: Request) {
  // Check admin auth
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('image') as File
    if (!file) {
      return NextResponse.json({ error: 'no file' }, { status: 400 })
    }

    const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'no telegram token' }, { status: 500 })
    }

    // Get private chat ID (pickeepersbot)
    let privChat = process.env.TELEGRAM_PRIVATE_CHAT
    if (!privChat) {
      // Try to get from settings or use first private chat
      const updates = await (await fetch(
        `https://api.telegram.org/bot${token}/getUpdates?limit=100`,
        { signal: AbortSignal.timeout(10000) }
      )).json()
      
      for (const u of updates.result || []) {
        if (u.message?.chat?.type === 'private') {
          privChat = String(u.message.chat.id)
          break
        }
      }
    }

    if (!privChat) {
      return NextResponse.json({ error: 'private chat not found' }, { status: 500 })
    }

    // Convert file to buffer and send to Telegram
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const form = new FormData()
    form.append('chat_id', privChat)
    form.append('photo', new Blob([new Uint8Array(buffer)], { type: file.type }), 'upload.jpg')
    form.append('caption', `Uploaded from PromptsFA admin - ${new Date().toISOString()}`)

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30000),
    })

    const result = await res.json()
    if (!result.ok) {
      return NextResponse.json({ error: result.description || 'upload failed' }, { status: 500 })
    }

    // Get file_id and file_path
    const fileId = result.result.photo[result.result.photo.length - 1].file_id
    
    // Get file_path for direct URL
    const fileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const fileInfo = await fileRes.json()
    
    const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.result.file_path}`

    return NextResponse.json({
      ok: true,
      fileId,
      fileUrl,
      message: 'uploaded to telegram successfully'
    })

  } catch (err: any) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: err.message || 'upload failed' }, { status: 500 })
  }
}
