#!/bin/bash
set -e

cat > src/app/api/debug/tg-bot-test/route.ts << 'EOF'
import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no TELEGRAM_BOT_TOKEN' }, { status: 500 })
  const api = (m: string, q?: Record<string, string>) =>
    'https://api.telegram.org/bot' + token + '/' + m + (q ? '?' + new URLSearchParams(q).toString() : '')

  // 1) bot identity
  let me: any = {}
  try { me = await (await fetch(api('getMe'), { signal: AbortSignal.timeout(8000) })).json() }
  catch (e: any) { return NextResponse.json({ step: 'getMe', error: e.message }) }

  // 2) chat info
  let chat: any = {}
  try { chat = await (await fetch(api('getChat', { chat_id: '@Prompts_fa' }), { signal: AbortSignal.timeout(8000) })).json() }
  catch (e: any) { return NextResponse.json({ step: 'getChat', error: e.message }) }

  if (!chat.ok) {
    return NextResponse.json({ step: 'getChat', error: chat.description, me })
  }
  const chatId = String(chat.result.id)
  const botId = String(me.result.id)

  // 3) check if bot is actually an admin in the channel
  let member: any = {}
  try {
    member = await (await fetch(api('getChatMember', { chat_id: chatId, user_id: botId }), { signal: AbortSignal.timeout(8000) })).json()
  } catch (e: any) {
    member = { error: e.message }
  }

  // 4) get latest updates (force include channel_post)
  let updates: any = {}
  try {
    updates = await (await fetch(
      api('getUpdates', { limit: '5', allowed_updates: JSON.stringify(['channel_post', 'message']) }),
      { signal: AbortSignal.timeout(10000) }
    )).json()
  } catch (e: any) {
    updates = { error: e.message }
  }

  // 5) count channel posts in updates
  const posts = (updates.result || []).filter((u: any) => u.channel_post && String(u.channel_post.chat.id) === chatId)

  return NextResponse.json({
    bot: { id: botId, username: me.result?.username },
    chat: { id: chatId, title: chat.result.title, type: chat.result.type },
    memberStatus: member.ok ? member.result?.status : 'error: ' + (member.description || member.error || JSON.stringify(member)),
    isCreatorOrAdmin: member.ok && (member.result?.status === 'administrator' || member.result?.status === 'creator'),
    totalUpdates: (updates.result || []).length,
    channelPostsInUpdates: posts.length,
    hint: !member.ok || !['administrator', 'creator'].includes(member.result?.status)
      ? '⚠️ بات admin نیست! در کانال @Prompts_fa → Edit → Administrators → Add → @' + (me.result?.username ?? 'bot')
      : posts.length === 0
      ? '✅ بات admin است ولی پیام جدیدی بعد از admin شدن نیامده. یک پست عکس‌دار جدید در کانال بفرست و دوباره تست کن.'
      : '✅ همه‌چیز آماده است! cron به‌زودی پست را می‌گیرد.',
  })
}
EOF

echo "✅ bot test v2!"