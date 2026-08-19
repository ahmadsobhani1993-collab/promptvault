#!/bin/bash
set -e

# ---------- 1) Unified Upload Route (Exactly like Prompts) ----------
cat > src/app/api/upload-to-telegram/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

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

    const channelUsername = 'promptsfa1'

    // 1. Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 2. Send to Channel (for archive)
    const tgForm = new FormData()
    tgForm.append('chat_id', '@' + channelUsername)
    tgForm.append('photo', new Blob([new Uint8Array(buffer)], { type: file.type || 'image/jpeg' }), 'upload.jpg')
    tgForm.append('caption', `📤 آپلود از پنل ادمین PromptsFA\n📅 ${new Date().toLocaleString('fa-IR')}`)

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: tgForm,
      signal: AbortSignal.timeout(30000),
    })

    const tgResult = await tgRes.json()
    if (!tgResult.ok) {
      console.error('Telegram upload failed:', tgResult)
      return NextResponse.json({ 
        error: tgResult.description || 'upload failed',
        hint: 'مطمئن شوید ربات در کانال @promptsfa1 ادمین است'
      }, { status: 500 })
    }

    // 3. Get file_id
    const fileId = tgResult.result.photo[tgResult.result.photo.length - 1].file_id
    
    // 4. Get file_path (EXACTLY like the prompt import-loop)
    const fileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const fileInfo = await fileRes.json()
    
    if (!fileInfo.ok) {
      return NextResponse.json({ error: 'failed to get file path' }, { status: 500 })
    }
    
    // 5. Construct the standard Telegram file URL
    const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.result.file_path}`

    return NextResponse.json({
      ok: true,
      fileUrl: fileUrl, // This is the exact same format as working prompts
      channel: '@' + channelUsername,
      message: 'عکس با موفقیت در کانال آرشیو و لینک استاندارد ساخته شد.'
    })

  } catch (err: any) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: err.message || 'upload failed' }, { status: 500 })
  }
}
EOF
echo "✅ Upload route: Now uses the EXACT same logic as prompt import-loop"

# ---------- 2) Test specific image URL route ----------
mkdir -p src/app/api/debug/test-image-url
cat > src/app/api/debug/test-image-url/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Please provide ?url=...' }, { status: 400 })
  }

  try {
    const res = await fetch(url, { 
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000) 
    })
    
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get('content-type'),
      contentLength: res.headers.get('content-length'),
      hint: res.ok ? 'لینک سالم است و باید در سایت نمایش داده شود.' : 'لینک خراب است یا تلگرام دسترسی را بسته است.'
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message })
  }
}
EOF
echo "✅ Image URL tester created"

echo ""
echo "===== WHY THIS WORKS ====="
echo "This script now does EXACTLY what the prompt import-loop does:"
echo "1. Sends to @promptsfa1"
echo "2. Gets file_id"
echo "3. Gets file_path"
echo "4. Saves: https://api.telegram.org/file/bot<TOKEN>/<file_path>"
echo ""
echo "If a prompt image works with this format, the article image WILL work too."
echo "===== NEXT STEPS ====="
echo "1. Deploy this code."
echo "2. Go to /admin/articles/new or edit an existing article."
echo "3. Upload a NEW image using the button."
echo "4. Save and check the website."
echo "======================================"

echo "✅ update199 done!"