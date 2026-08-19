import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('image') as File
    if (!file) {
      return NextResponse.json({ error: 'no file' }, { status: 400 })
    }

    const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'telegram token not configured' }, { status: 500 })
    }

    // Channel username (without @)
    const channelUsername = 'promptsfa1' // Fixed channel
    
    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Send photo to CHANNEL
    const form = new FormData()
    form.append('chat_id', '@' + channelUsername)
    form.append('photo', new Blob([new Uint8Array(buffer)], { type: file.type || 'image/jpeg' }), 'upload.jpg')
    form.append('caption', `📤 Uploaded from PromptsFA Admin\n📅 ${new Date().toLocaleString('fa-IR')}`)

    const uploadRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30000),
    })

    const result = await uploadRes.json()
    if (!result.ok) {
      console.error('Telegram channel upload failed:', result)
      return NextResponse.json({ 
        error: result.description || 'upload failed',
        hint: 'Make sure bot is admin in channel @' + channelUsername
      }, { status: 500 })
    }

    // Get file_id from the uploaded photo
    const fileId = result.result.photo[result.result.photo.length - 1].file_id
    
    // Get file_path for direct CDN URL
    const fileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const fileInfo = await fileRes.json()
    
    if (!fileInfo.ok) {
      console.error('Failed to get file info:', fileInfo)
      return NextResponse.json({ error: 'failed to get file path' }, { status: 500 })
    }
    
    // Generate Telegram CDN URL (more stable than bot API URL)
    const filePath = fileInfo.result.file_path
    const fileId_parts = fileId.split(':')[0] // Get first part of file_id for CDN
    const cdnUrl = `https://cdn.telega.one/file/bot${token}/${filePath}`
    
    // Also provide the standard bot API URL as fallback
    const botApiUrl = `https://api.telegram.org/file/bot${token}/${filePath}`

    return NextResponse.json({
      ok: true,
      fileId,
      filePath,
      fileUrl: botApiUrl, // Use bot API URL
      cdnUrl, // Alternative CDN URL
      channel: '@' + channelUsername,
      message: 'uploaded to channel successfully'
    })

  } catch (err: any) {
    console.error('Upload error:', err)
    return NextResponse.json({ 
      error: err.message || 'upload failed',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 })
  }
}
