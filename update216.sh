#!/bin/bash
set -e

# ---------- 1) Check if prompts have images ----------
mkdir -p src/app/api/debug/check-images
cat > src/app/api/debug/check-images/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startId = parseInt(searchParams.get('start') || '3660')
  const endId = parseInt(searchParams.get('end') || '3670')

  // Get prompts in range
  const prompts = await prisma.prompt.findMany({
    where: {
      slug: {
        in: Array.from({ length: endId - startId + 1 }, (_, i) => `tg-${startId + i}`)
      }
    },
    select: {
      id: true,
      slug: true,
      titleFa: true,
      img: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const results: any[] = []
  for (const prompt of prompts) {
    const hasImage = !!prompt.img
    const isTelegramUrl = prompt.img?.includes('api.telegram.org')
    
    results.push({
      slug: prompt.slug,
      title: prompt.titleFa,
      hasImage,
      isTelegramUrl,
      imageUrl: prompt.img?.slice(0, 100) + '...',
    })
  }

  const withImages = results.filter(r => r.hasImage).length
  const withoutImages = results.filter(r => !r.hasImage).length

  return NextResponse.json({
    ok: true,
    range: { start: startId, end: endId },
    total: prompts.length,
    withImages,
    withoutImages,
    prompts: results,
    hint: withoutImages > 0 ? 'برخی پرامپت‌ها بدون عکس هستند' : 'همه پرامپت‌ها عکس دارند',
  })
}
EOF
echo "✅ Check images route created"

# ---------- 2) Fix missing images for specific prompts ----------
mkdir -p src/app/api/debug/fix-missing-images
cat > src/app/api/debug/fix-missing-images/route.ts << 'EOF'
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
EOF
echo "✅ Fix missing images route created"

# ---------- 3) Batch fix all missing images ----------
mkdir -p src/app/api/debug/batch-fix-images
cat > src/app/api/debug/batch-fix-images/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startId = parseInt(searchParams.get('start') || '3660')
  const endId = parseInt(searchParams.get('end') || '3670')
  const batchSize = parseInt(searchParams.get('batch') || '5')

  // Get prompts without images
  const prompts = await prisma.prompt.findMany({
    where: {
      slug: {
        in: Array.from({ length: endId - startId + 1 }, (_, i) => `tg-${startId + i}`)
      },
      img: null,
    },
    select: { id: true, slug: true, titleFa: true },
    take: batchSize,
  })

  if (prompts.length === 0) {
    return NextResponse.json({
      ok: true,
      message: 'No prompts without images in this range',
    })
  }

  return NextResponse.json({
    ok: true,
    found: prompts.length,
    prompts: prompts.map(p => ({
      slug: p.slug,
      title: p.titleFa,
      fixUrl: `https://promptsfa.ir/api/debug/fix-missing-images?key=pv-cron-8x2m1q&slug=${p.slug}`,
    })),
    hint: `برای修复 هر پرامپت، روی fixUrl کلیک کنید`,
  })
}
EOF
echo "✅ Batch fix images route created"

echo ""
echo "===== AFTER DEPLOY ====="
echo ""
echo "Step 1: Check which prompts are missing images (3660-3670)"
echo "  https://promptsfa.ir/api/debug/check-images?key=pv-cron-8x2m1q&start=3660&end=3670"
echo ""
echo "Step 2: Fix a specific prompt (e.g., tg-3666)"
echo "  https://promptsfa.ir/api/debug/fix-missing-images?key=pv-cron-8x2m1q&slug=tg-3666"
echo ""
echo "Step 3: Batch find all missing images (3660-3700)"
echo "  https://promptsfa.ir/api/debug/batch-fix-images?key=pv-cron-8x2m1q&start=3660&end=3700&batch=10"
echo ""
echo "=================================="

echo "✅ update216 done!"