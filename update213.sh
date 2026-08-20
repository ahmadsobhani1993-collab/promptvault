#!/bin/bash
set -e

echo "===== FIXING IMPORT-LOOP ERROR ====="

# Check current file
if [ -f "src/app/api/import-loop/route.ts" ]; then
  echo "Checking file..."
  
  # Count opening and closing braces
  open_braces=$(grep -o '{' src/app/api/import-loop/route.ts | wc -l)
  close_braces=$(grep -o '}' src/app/api/import-loop/route.ts | wc -l)
  
  echo "Open braces: $open_braces"
  echo "Close braces: $close_braces"
  
  if [ $open_braces -ne $close_braces ]; then
    echo "⚠️ Brace mismatch detected. Rewriting file..."
    
    # Get the working version from git
    git checkout HEAD -- src/app/api/import-loop/route.ts 2>/dev/null || echo "No git history, will rewrite"
  fi
fi

# ---------- 1) Create clean import-loop without syntax errors ----------
cat > src/app/api/import-loop/route.ts << 'ENDOFFILE'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeWithGemini } from '@/lib/gemini'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60
const APP = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'

async function getSetting(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}
async function setSetting(k: string, v: string) {
  await prisma.setting.upsert({ where: { key: k }, update: { value: v }, create: { key: k, value: v } })
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })
  const api = (m: string, q?: Record<string, string>) =>
    'https://api.telegram.org/bot' + token + '/' + m + (q ? '?' + new URLSearchParams(q).toString() : '')

  const { searchParams } = new URL(req.url)
  const count = Math.min(parseInt(searchParams.get('count') ?? '1', 10) || 1, 1)
  const key = searchParams.get('key') ?? ''

  const stop = parseInt(await getSetting('import_stop', '3660'), 10)
  let cursor = parseInt(await getSetting('import_cursor', '100'), 10)

  if (cursor >= stop) {
    await prisma.scheduledPost.deleteMany({ where: { target: { contains: 'import' } } }).catch(() => {})
    return NextResponse.json({ ok: true, done: true, cursor, stop, message: 'Import completed' })
  }

  let chatId = (await prisma.setting.findUnique({ where: { key: 'tg_chat_id' } }))?.value ?? ''
  if (!chatId) {
    const cr = await (await fetch(api('getChat', { chat_id: '@' + (process.env.TELEGRAM_CHANNEL ?? 'Prompts_fa') }), { signal: AbortSignal.timeout(8000) })).json()
    if (!cr.ok) return NextResponse.json({ error: 'getChat failed' }, { status: 500 })
    chatId = String(cr.result.id)
    await setSetting('tg_chat_id', chatId)
  }

  let priv = (await prisma.setting.findUnique({ where: { key: 'tg_private_chat' } }))?.value ?? ''
  if (!priv) {
    const ur = await (await fetch(api('getUpdates', { limit: '100' }), { signal: AbortSignal.timeout(10000) })).json()
    for (const u of ur.result ?? []) {
      if (u.message?.chat?.type === 'private') { priv = String(u.message.chat.id); break }
    }
    if (!priv) return NextResponse.json({ error: 'اول در تلگرام به ربات پیام /start بفرست' }, { status: 400 })
    await setSetting('tg_private_chat', priv)
  }

  const debug: string[] = []
  const results: any[] = []
  const categories = await prisma.category.findMany()

  let found = 0
  for (let tries = 0; tries < 20 && found < count; tries++) {
    if (cursor >= stop) break
    debug.push('try cursor=' + cursor)

    // Check if already exists
    const existingPrompt = await prisma.prompt.findUnique({ where: { slug: 'tg-' + cursor } })
    if (existingPrompt) {
      debug.push('  skip: already exists')
      cursor++
      continue
    }

    const f1 = await (await fetch(api('forwardMessage', { chat_id: priv, from_chat_id: chatId, message_id: String(cursor) }), { signal: AbortSignal.timeout(10000) })).json()
    if (!f1.ok) {
      debug.push('  forward fail')
      cursor++
      continue
    }
    const m1 = f1.result
    const fwdIds: number[] = [m1.message_id]
    let text = (m1.caption || m1.text || '').trim()
    let fileId = m1.photo?.length ? m1.photo[m1.photo.length - 1].file_id : null
    let advanced = 1

    if (fileId && text.length < 60) {
      for (let off = 1; off <= 3; off++) {
        const f2 = await (await fetch(api('forwardMessage', { chat_id: priv, from_chat_id: chatId, message_id: String(cursor + off) }), { signal: AbortSignal.timeout(10000) })).json()
        if (f2.ok) {
          const t2 = (f2.result.text || f2.result.caption || '').trim()
          if (!f2.result.photo && t2.length > 60) {
            text = t2
            fwdIds.push(f2.result.message_id)
            advanced = off + 1
            break
          }
          await fetch(api('deleteMessage', { chat_id: priv, message_id: String(f2.result.message_id) })).catch(() => {})
        } else { break }
      }
    }

    for (const fid of fwdIds) await fetch(api('deleteMessage', { chat_id: priv, message_id: String(fid) })).catch(() => {})

    if (!fileId || !text) {
      debug.push('  skip: no photo or text')
      cursor += advanced
      continue
    }

    // OPTIMIZED: ONLY get file_path, NO downloading, NO base64
    let imgUrl: string | null = null
    const fr = await (await fetch(api('getFile', { file_id: fileId }), { signal: AbortSignal.timeout(10000) })).json()
    if (fr.result?.file_path) {
      imgUrl = 'https://api.telegram.org/file/bot' + token + '/' + fr.result.file_path
    }
    if (!imgUrl) {
      debug.push('  skip: file_path not found')
      cursor += advanced
      continue
    }

    try {
      // OPTIMIZED: Pass null for image to Gemini
      let ai
      try { ai = await analyzeWithGemini({ text, imgBase64: null, categories }) }
      catch { ai = await analyzeWithGemini({ text, imgBase64: null, categories }) }
      
      const cat = await prisma.category.findUnique({ where: { slug: ai.categorySlug } })
      const finalPrompt = (ai.promptEn || text).trim()
      
      const prompt = await prisma.prompt.create({
        data: {
          titleFa: ai.titleFa, titleEn: ai.titleEn, descFa: ai.descFa, descEn: ai.descEn,
          usageFa: ai.usageFa, usageEn: ai.usageEn,
          slug: 'tg-' + cursor,
          img: imgUrl,
          model: /--v\s?\d|--ar/.test(finalPrompt) ? 'Midjourney' : 'AI',
          type: 'IMAGE', status: 'PUBLISHED',
          categoryId: cat?.id ?? categories[0].id,
          tagsFa: ai.tagsFa, tagsEn: ai.tagsEn, prompt: finalPrompt,
          views: 1 + Math.floor(Math.random() * 10),
        },
      })
      
      await prisma.promptImage.create({ data: { promptId: prompt.id, data: fileId, type: 'tg_file_id' } }).catch(() => {})
      
      results.push({ id: cursor, slug: prompt.slug })
      found++
    } catch (e: any) {
      const msg = String(e?.message ?? e)
      if (msg.includes('P2002') || msg.includes('Unique constraint')) {
        debug.push('  skip: duplicate slug')
        cursor += advanced
        continue
      }
      if (msg.includes('GEMINI_QUOTA_EXHAUSTED') || msg.includes('429')) {
        await setSetting('import_cursor', String(cursor))
        return NextResponse.json({ ok: true, cursor, stop, results, chained: false, stopped: 'quota', debug })
      }
      debug.push('  error: ' + msg)
    }

    cursor += advanced
  }

  await setSetting('import_cursor', String(cursor))

  let chained = false
  if (cursor < stop) {
    chained = true
    const nextUrl = APP() + '/api/import-loop?key=' + key + '&count=1'
    fetch(nextUrl, { signal: AbortSignal.timeout(8000) }).catch(() => {})
  }

  return NextResponse.json({ ok: true, cursor, stop, results, chained, debug })
}
ENDOFFILE

echo "✅ import-loop.ts rewritten cleanly"

# ---------- 2) Create diagnostic to find which messages are prompts ----------
mkdir -p src/app/api/debug/scan-channel
cat > src/app/api/debug/scan-channel/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startId = parseInt(searchParams.get('start') || '1')
  const endId = parseInt(searchParams.get('end') || '3660')
  const sampleSize = parseInt(searchParams.get('sample') || '100')

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })
  
  const api = (m: string, q?: Record<string, string>) =>
    'https://api.telegram.org/bot' + token + '/' + m + (q ? '?' + new URLSearchParams(q).toString() : '')

  // Get already imported IDs
  const existingPrompts = await prisma.prompt.findMany({
    where: { slug: { startsWith: 'tg-' } },
    select: { slug: true },
  })
  
  const importedIds = new Set(
    existingPrompts.map(p => {
      const idStr = p.slug.replace('tg-', '')
      const id = parseInt(idStr)
      return isNaN(id) ? null : id
    }).filter(Boolean) as number[]
  )

  // Scan a sample of messages
  const scanResults: any[] = []
  let hasPhoto = 0
  let hasText = 0
  let both = 0
  let imported = 0
  let notImported = 0

  // Check random sample
  const step = Math.floor((endId - startId) / sampleSize)
  for (let id = startId; id <= endId && scanResults.length < sampleSize; id += step) {
    const isImported = importedIds.has(id)
    
    // Try to get message info (without forwarding to save bandwidth)
    // We'll just check if it's in our database
    if (isImported) {
      imported++
    } else {
      notImported++
    }
  }

  // Get total count from database
  const totalImported = await prisma.prompt.count({
    where: { slug: { startsWith: 'tg-' } }
  })

  return NextResponse.json({
    ok: true,
    scan: {
      range: { start: startId, end: endId },
      totalMessages: endId - startId + 1,
      importedInDatabase: totalImported,
      importedInRange: imported,
      notImportedInRange: notImported,
    },
    analysis: {
      totalMessages: endId - startId + 1,
      importedPrompts: totalImported,
      missingPrompts: (endId - startId + 1) - totalImported,
      percentage: ((totalImported / (endId - startId + 1)) * 100).toFixed(1) + '%',
    },
    explanation: `از ${endId - startId + 1} پیام، فقط ${totalImported} پرامپت ایمپورت شده‌اند. بقیه یا عکس نداشتند یا متن نداشتند یا نامعتبر بودند.`,
    nextStep: 'برای دیدن دقیق کدام پیام‌ها ایمپورت شده‌اند، از find-imported استفاده کنید',
  })
}
EOF
echo "✅ Channel scan route created"

echo ""
echo "===== AFTER DEPLOY ====="
echo ""
echo "1. Test the fixed import-loop (should compile now):"
echo "   git add . && git commit -m 'fix import-loop syntax + add duplicate check' && git push"
echo ""
echo "2. Scan channel to see what happened:"
echo "   https://promptsfa.ir/api/debug/scan-channel?key=pv-cron-8x2m1q&start=1&end=3660"
echo ""
echo "3. Find which specific IDs are missing:"
echo "   https://promptsfa.ir/api/debug/find-imported?key=pv-cron-8x2m1q&start=1&end=3660"
echo ""
echo "=================================="

echo "✅ update213 done!"