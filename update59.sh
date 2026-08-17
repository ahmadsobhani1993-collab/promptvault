#!/bin/bash
set -e

cat > src/app/api/debug/tg-bot-test/route.ts << 'EOF'
import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no TELEGRAM_BOT_TOKEN' }, { status: 500 })

  const api = (m: string, q?: Record<string, string>) => {
    const u = 'https://api.telegram.org/bot' + token + '/' + m
    return q ? u + '?' + new URLSearchParams(q).toString() : u
  }

  // 1) test bot identity
  let me: any = {}
  try {
    me = await (await fetch(api('getMe'), { signal: AbortSignal.timeout(8000) })).json()
  } catch (e: any) {
    return NextResponse.json({ step: 'getMe', error: e.message })
  }

  // 2) get chat by username
  let chat: any = {}
  try {
    const r = await fetch(api('getChat', { chat_id: '@Prompts_fa' }), { signal: AbortSignal.timeout(8000) })
    chat = await r.json()
  } catch (e: any) {
    return NextResponse.json({ step: 'getChat', error: e.message, me })
  }

  if (!chat.ok) {
    return NextResponse.json({
      step: 'getChat',
      error: chat.description || 'not ok',
      me,
      hint: 'بات باید admin کانال باشد. در کانال @Prompts_fa → Edit → Administrators → Add → @pickeeperbot',
    })
  }

  const chatId = String(chat.result.id)
  const title = chat.result.title

  // 3) get latest updates (last messages forwarded to bot)
  let updates: any[] = []
  try {
    const r = await fetch(api('getUpdates', { limit: '5' }), { signal: AbortSignal.timeout(8000) })
    const j = await r.json()
    updates = j.result || []
  } catch {}

  // 4) find a channel post with photo
  let sample: any = null
  for (const u of updates) {
    const post = u.channel_post || u.message
    if (post?.chat?.id == chatId && post.photo && post.photo.length) {
      const best = post.photo[post.photo.length - 1]
      sample = {
        post_id: post.message_id,
        text: (post.text || post.caption || '').slice(0, 120),
        file_id: best.file_id,
        file_size: best.file_size,
        width: best.width,
        height: best.height,
      }
      break
    }
  }

  // 5) download the photo if found
  let download: any = null
  if (sample) {
    try {
      const r1 = await fetch(api('getFile', { file_id: sample.file_id }), { signal: AbortSignal.timeout(10000) })
      const j1 = await r1.json()
      const path = j1.result?.file_path
      if (path) {
        const fileUrl = 'https://api.telegram.org/file/bot' + token + '/' + path
        const r2 = await fetch(fileUrl, { signal: AbortSignal.timeout(15000) })
        const buf = Buffer.from(await r2.arrayBuffer())
        download = {
          url: fileUrl.slice(0, 80) + '...',
          size: buf.length,
          type: r2.headers.get('content-type'),
          ok: r2.ok && buf.length > 10000,
        }
      }
    } catch (e: any) {
      download = { error: e.message }
    }
  }

  return NextResponse.json({
    bot: me.result?.username,
    chat: { id: chatId, title, type: chat.result.type },
    updatesReceived: updates.length,
    sampleChannelPhoto: sample,
    download,
    nextStep: sample?.ok === false || !sample
      ? 'یک پیام در کانال @Prompts_fa بفرست، بعد دوباره این URL را باز کن'
      : 'chat_id آماده است: ' + chatId,
  })
}
EOF

echo "✅ bot test endpoint ready!"