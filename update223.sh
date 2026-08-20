#!/bin/bash
set -e

echo "===== FINAL CLEAN IMPORT SETUP ====="

# ---------- 1) Route to manually set the private channel numeric ID ----------
mkdir -p src/app/api/debug/set-private-channel
cat > src/app/api/debug/set-private-channel/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const channelId = searchParams.get('id') // e.g., -1001234567890

  if (!channelId || !channelId.startsWith('-100')) {
    return NextResponse.json({ 
      error: 'Invalid ID', 
      hint: 'Please provide a valid numeric channel ID starting with -100 (e.g., ?id=-1001234567890)' 
    }, { status: 400 })
  }

  await prisma.setting.upsert({
    where: { key: 'tg_chat_id' },
    update: { value: channelId },
    create: { key: 'tg_chat_id', value: channelId },
  })

  return NextResponse.json({
    ok: true,
    message: `Channel ID ${channelId} saved successfully. Import loop will now use this private channel.`,
  })
}
EOF
echo "✅ Private channel ID setter created"

# ---------- 2) COMPLETELY REWRITE import-loop to ONLY save Telegram URL ----------
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
  const count = Math.min(parseInt(searchParams.get('count') ?? '1', 10) || 1, 10)
  const key = searchParams.get('key') ?? ''

  const stop = parseInt(await getSetting('import_stop', '10000'), 10)
  let cursor = parseInt(await getSetting('import_cursor', '1'), 10)

  if (cursor >= stop) {
    return NextResponse.json({ ok: true, done: true, cursor, stop, message: 'Import completed' })
  }

  // Use the numeric chat ID for the private channel
  const chatId = await getSetting('tg_chat_id', '')
  if (!chatId) {
    return NextResponse.json({ error: 'tg_chat_id (numeric) not set. Use /api/debug/set-private-channel?id=-100...' }, { status: 500 })
  }

  let priv = await getSetting('tg_private_chat', '')
  if (!priv) {
    const ur = await (await fetch(api('getUpdates', { limit: '100' }), { signal: AbortSignal.timeout(10000) })).json()
    for (const u of ur.result ?? []) {
      if (u.message?.chat?.type === 'private') { priv = String(u.message.chat.id); break }
    }
    if (!priv) return NextResponse.json({ error: 'Send /start to the bot first' }, { status: 400 })
    await setSetting('tg_private_chat', priv)
  }

  const debug: string[] = []
  const results: any[] = []
  const categories = await prisma.category.findMany()

  let found = 0
  for (let tries = 0; tries < 30 && found < count; tries++) {
    if (cursor >= stop) break
    debug.push('try cursor=' + cursor)

    // Skip if already exists
    const existing = await prisma.prompt.findUnique({ where: { slug: 'tg-' + cursor } })
    if (existing) {
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

    // Pair with next message if text is too short
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

    // ✅ CRITICAL: ONLY get file_path, NO downloading, NO arrayBuffer, NO base64
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
      // ✅ CRITICAL: Send ONLY text to Gemini, NO image buffer
      let ai
      try { ai = await analyzeWithGemini({ text, imgBase64: null, categories }) }
      catch { ai = await analyzeWithGemini({ text, imgBase64: null, categories }) }
      
      const cat = await prisma.category.findUnique({ where: { slug: ai.categorySlug } })
      const finalPrompt = (ai.promptEn || text).trim()
      
      // ✅ CRITICAL: Save ONLY the Telegram URL string in the database
      const prompt = await prisma.prompt.create({
        data: {
          titleFa: ai.titleFa, titleEn: ai.titleEn, descFa: ai.descFa, descEn: ai.descEn,
          usageFa: ai.usageFa, usageEn: ai.usageEn,
          slug: 'tg-' + cursor,
          img: imgUrl, // <-- DIRECT TELEGRAM URL, NO LOCAL STORAGE
          model: /--v\s?\d|--ar/.test(finalPrompt) ? 'Midjourney' : 'AI',
          type: 'IMAGE', status: 'PUBLISHED',
          categoryId: cat?.id ?? categories[0].id,
          tagsFa: ai.tagsFa, tagsEn: ai.tagsEn, prompt: finalPrompt,
          views: 1 + Math.floor(Math.random() * 10),
        },
      })
      
      results.push({ id: cursor, slug: prompt.slug, imgUrl })
      found++
    } catch (e: any) {
      const msg = String(e?.message ?? e)
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
  if (cursor < stop && found > 0) {
    chained = true
    const nextUrl = APP() + '/api/import-loop?key=' + key + '&count=' + count
    fetch(nextUrl, { signal: AbortSignal.timeout(8000) }).catch(() => {})
  }

  return NextResponse.json({ ok: true, cursor, stop, results, chained, debug })
}
ENDOFFILE
echo "✅ Import loop rewritten: 100% no local storage, only direct Telegram URLs."

echo ""
echo "===== NEXT STEPS (DO THIS EXACTLY) ====="
echo ""
echo "1. Deploy this code:"
echo "   git add . && git commit -m 'final clean import: direct telegram urls only' && git push"
echo ""
echo "2. After deploy, set your private channel numeric ID (Replace -100... with your actual channel ID):"
echo "   https://promptsfa.ir/api/debug/set-private-channel?key=pv-cron-8x2m1q&id=-100YOUR_CHANNEL_ID_HERE"
echo ""
echo "3. Test import 5 prompts:"
echo "   https://promptsfa.ir/api/import-loop?key=pv-cron-8x2m1q&count=5"
echo ""
echo "4. Check database to confirm it saved Telegram links:"
echo "   https://promptsfa.ir/api/debug/check-db-images?key=pv-cron-8x2m1q"
echo "========================================"

echo "✅ update223 done!"