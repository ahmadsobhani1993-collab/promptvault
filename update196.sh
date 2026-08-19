#!/bin/bash
set -e

# ---------- 1) Update upload route to send to channel ----------
cat > src/app/api/upload-to-telegram/route.ts << 'EOF'
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
    const channelUsername = process.env.TELEGRAM_CHANNEL || 'promptsfa1'
    
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
EOF
echo "✅ Upload route: now sends to channel @promptsfa1"

# ---------- 2) Create channel ID helper ----------
mkdir -p src/app/api/debug/channel-id
cat > src/app/api/debug/channel-id/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })

  const channelUsername = process.env.TELEGRAM_CHANNEL || 'promptsfa1'

  try {
    // Get channel info
    const chatRes = await fetch(
      `https://api.telegram.org/bot${token}/getChat?chat_id=@${channelUsername}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const chatResult = await chatRes.json()
    
    if (!chatResult.ok) {
      return NextResponse.json({
        ok: false,
        error: chatResult.description,
        hint: 'Make sure bot is admin in channel @' + channelUsername
      })
    }

    const chat = chatResult.result
    const channelId = chat.id

    // Save to settings
    await prisma.setting.upsert({
      where: { key: 'tg_channel_chat_id' },
      update: { value: String(channelId) },
      create: { key: 'tg_channel_chat_id', value: String(channelId) },
    })

    return NextResponse.json({
      ok: true,
      channel: {
        id: channelId,
        username: chat.username,
        title: chat.title,
        type: chat.type,
      },
      saved: true,
      hint: 'Channel ID saved. Bot must be admin to upload.',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
EOF
echo "✅ Channel ID helper created"

echo ""
echo "===== IMPORTANT SETUP ====="
echo "1. Make sure your bot (@your_bot_username) is ADMIN in channel @promptsfa1"
echo "   - Go to channel settings"
echo "   - Add bot as administrator with 'Post Messages' permission"
echo ""
echo "2. Test channel connection:"
echo "   https://promptsfa.ir/api/debug/channel-id?key=pv-cron-8x2m1q"
echo ""
echo "3. Test upload:"
echo "   - Go to /admin/articles/new"
echo "   - Upload an image"
echo "   - Check if it appears in @promptsfa1 channel"
echo "==========================="

echo "✅ update196 done!"