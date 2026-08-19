#!/bin/bash
set -e

# ---------- 1) API endpoint: Upload image to Telegram ----------
mkdir -p src/app/api/upload-to-telegram
cat > src/app/api/upload-to-telegram/route.ts << 'EOF'
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
EOF
echo "✅ Telegram upload API endpoint created"

# ---------- 2) Update Article Form with upload button ----------
node << 'NODEEOF'
const fs = require('fs')
const p = 'src/components/article-form.tsx'
let s = fs.readFileSync(p, 'utf8')

// Add upload state and function
if (!s.includes('const [uploading, setUploading]')) {
  s = s.replace(
    "const [msg, setMsg] = useState('')",
    "const [msg, setMsg] = useState('')\n  const [uploading, setUploading] = useState(false)"
  )
}

// Add upload function before submit
if (!s.includes('const handleImageUpload')) {
  const uploadFunc = `
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/upload-to-telegram', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.ok) {
        // Update the img input field with the Telegram URL
        const imgInput = document.querySelector('input[name="img"]') as HTMLInputElement
        if (imgInput) {
          imgInput.value = data.fileUrl
        }
        setMsg('✅ عکس با موفقیت آپلود شد')
      } else {
        setMsg('خطا در آپلود: ' + (data.error || 'نامشخص'))
      }
    } catch (err) {
      setMsg('خطا در ارتباط با سرور')
    } finally {
      setUploading(false)
    }
  }
`
  s = s.replace(/const submit = async/, uploadFunc + '\n  const submit = async')
}

// Add upload button in the img field section
if (!s.includes('type="file"')) {
  s = s.replace(
    /(<div>\s*<label[^>]*>آدرس تصویر کاور[^<]*<\/label>\s*<input name="img"[^>]*\/>)/,
    `$1
        <div className="mt-2">
          <label className="block text-xs text-ink-muted mb-1">یا آپلود مستقیم از کامپیوتر:</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleImageUpload}
            disabled={uploading}
            className="input text-xs py-1.5"
          />
          {uploading && <p className="mt-1 text-xs text-gold-bright">در حال آپلود به تلگرام...</p>}
        </div>`
  )
  console.log('✅ Upload button added to img field')
} else {
  console.log('⚠️ Upload button already exists')
}

// Clear message after a few seconds
if (!s.includes('setTimeout(() => setMsg')) {
  s = s.replace(
    /{msg && <p className="text-xs text-red-400">\{msg\}<\/p>}/,
    `{msg && (
      <p className="text-xs ' + (msg.includes('✅') ? 'text-green-400' : 'text-red-400') + '">' + '{msg}' + '</p>' +
      (setTimeout(() => setMsg(''), 3000) && '')
    )}`
  )
}

fs.writeFileSync(p, s)
console.log('✅ Article form: Telegram upload button added')
NODEEOF

echo "✅ update190 done!"