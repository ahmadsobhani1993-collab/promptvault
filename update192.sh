#!/bin/bash
set -e

echo "===== Checking API routes ====="
echo "1. Admin articles route:"
if [ -f "src/app/api/admin/articles/route.ts" ]; then
  echo "   ✅ Exists"
  echo "   Checking for 'article' variable issue..."
  grep -n "article is not defined\|const article" src/app/api/admin/articles/route.ts || echo "   No obvious issue found"
else
  echo "   ❌ NOT FOUND"
fi

echo ""
echo "2. Upload to telegram route:"
if [ -f "src/app/api/upload-to-telegram/route.ts" ]; then
  echo "   ✅ Exists"
else
  echo "   ❌ NOT FOUND"
fi
echo "================================="

# ---------- 1) Fix admin/articles route: article not defined ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/app/api/admin/articles/route.ts'
let s = fs.readFileSync(p, 'utf8')

// Fix: article variable not defined in update action
if (s.includes("action === 'update'") && !s.includes("const article = await prisma.article.findUnique")) {
  // Add article fetch before update
  s = s.replace(
    "if (action === 'update') {",
    `if (action === 'update') {
    const article = await prisma.article.findUnique({ where: { id } })
    if (!article) return NextResponse.json({ error: 'not found' }, { status: 404 })`
  )
  console.log('✅ Fixed: article variable in update action')
}

// Ensure j and id are properly defined
if (!s.includes('const j = await req.json()')) {
  s = s.replace(
    'const { id, action } = await req.json()',
    'const j = await req.json()\n  const { id, action } = j'
  )
  console.log('✅ Fixed: j variable definition')
}

fs.writeFileSync(p, s)
NODEEOF

# ---------- 2) Fix upload-to-telegram route ----------
cat > src/app/api/upload-to-telegram/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function POST(req: Request) {
  try {
    // Check admin auth
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
      console.error('No Telegram token configured')
      return NextResponse.json({ error: 'telegram token not configured' }, { status: 500 })
    }

    // Get private chat ID
    let privChat = process.env.TELEGRAM_PRIVATE_CHAT
    if (!privChat) {
      try {
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
      } catch (err) {
        console.error('Failed to get private chat:', err)
      }
    }

    if (!privChat) {
      return NextResponse.json({ 
        error: 'Private chat not found. First send a message to the bot.', 
        hint: 'Send /start to your bot in Telegram'
      }, { status: 500 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Send to Telegram
    const form = new FormData()
    form.append('chat_id', privChat)
    form.append('photo', new Blob([new Uint8Array(buffer)], { type: file.type || 'image/jpeg' }), 'upload.jpg')
    form.append('caption', `PromptsFA Upload - ${new Date().toLocaleString('fa-IR')}`)

    const uploadRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30000),
    })

    const result = await uploadRes.json()
    if (!result.ok) {
      console.error('Telegram upload failed:', result)
      return NextResponse.json({ error: result.description || 'upload failed' }, { status: 500 })
    }

    // Get file_id
    const fileId = result.result.photo[result.result.photo.length - 1].file_id
    
    // Get file_path for direct URL
    const fileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const fileInfo = await fileRes.json()
    
    if (!fileInfo.ok) {
      console.error('Failed to get file info:', fileInfo)
      return NextResponse.json({ error: 'failed to get file info' }, { status: 500 })
    }
    
    const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.result.file_path}`

    return NextResponse.json({
      ok: true,
      fileId,
      fileUrl,
      message: 'uploaded successfully'
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
echo "✅ Upload route: rewritten with better error handling"

# ---------- 3) Add missing env var info ----------
echo ""
echo "===== IMPORTANT: Environment Variables ====="
echo "Make sure these are set in Vercel:"
echo "  TELEGRAM_READ_TOKEN=your_bot_token"
echo "  TELEGRAM_BOT_TOKEN=your_bot_token"
echo "  TELEGRAM_PRIVATE_CHAT=your_private_chat_id (optional)"
echo "==========================================="
echo ""
echo "To get PRIVATE_CHAT_ID:"
echo "  1. Send /start to your bot in Telegram"
echo "  2. Visit: https://promptsfa.ir/api/debug/chat-id?key=pv-cron-8x2m1q"
echo ""

echo "✅ update192 done!"