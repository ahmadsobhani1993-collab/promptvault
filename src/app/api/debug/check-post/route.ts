import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 30

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const q = new URL(req.url).searchParams
  const msgId = parseInt(q.get('msgId') || '771', 10)

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })

  const chatId = (await prisma.setting.findUnique({ where: { key: 'tg_channel_chat_id' } }))?.value
  const privChat = (await prisma.setting.findUnique({ where: { key: 'tg_private_chat' } }))?.value
  if (!chatId || !privChat) return NextResponse.json({ error: 'missing chat IDs' }, { status: 500 })

  // 1. Forward پست از تلگرام
  const f = await fetch(
    `https://api.telegram.org/bot${token}/forwardMessage?chat_id=${privChat}&from_chat_id=${chatId}&message_id=${msgId}`
  ).then(r => r.json())

  if (!f.ok) {
    return NextResponse.json({ ok: false, error: 'forward failed: ' + f.description })
  }

  const msg = f.result
  const caption = (msg.caption || '').trim()
  const hasPhoto = !!msg.photo
  const hasVideo = !!msg.video

  // پاک کردن forwarded
  await fetch(
    `https://api.telegram.org/bot${token}/deleteMessage?chat_id=${privChat}&message_id=${msg.message_id}`
  ).catch(() => {})

  // 2. جستجو در DB با استفاده از متن پست
  // چند کلمه از caption را بگیر و در prompt جستجو کن
  const searchText = caption
    .replace(/✨\s*پرامپت\s*جدید\s*✨/gi, '')
    .replace(/@[\w_]+/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 5)
    .slice(0, 5)
    .join(' ')

  // 3. Slug تکراری
  const expectedSlug = 'tg-' + msgId
  const bySlug = await prisma.prompt.findUnique({ where: { slug: expectedSlug } })

  // 4. جستجو با متن (partial match)
  const byText = await prisma.prompt.findFirst({
    where: searchText.length > 10 ? {
      OR: [
        { prompt: { contains: searchText.slice(0, 100), mode: 'insensitive' } },
        { prompt: { contains: caption.slice(20, 100), mode: 'insensitive' } },
      ]
    } : undefined
  })

  return NextResponse.json({
    ok: true,
    msgId,
    telegram: {
      hasPhoto,
      hasVideo,
      captionLength: caption.length,
      preview: caption.slice(0, 200),
    },
    search: {
      keywords: searchText.slice(0, 200),
    },
    matches: {
      bySlug: bySlug ? {
        slug: bySlug.slug,
        title: bySlug.titleFa,
        status: bySlug.status,
        promptPreview: bySlug.prompt.slice(0, 100),
      } : null,
      byText: byText ? {
        slug: byText.slug,
        title: byText.titleFa,
        status: byText.status,
        promptPreview: byText.prompt.slice(0, 100),
      } : null,
    },
    verdict: bySlug 
      ? '⚠️ slug تکراری است (قبلاً ایمپورت شده)'
      : byText 
      ? '⚠️ متن تکراری است ولی با slug متفاوت (مثلاً tg-xxx یا github-yyy)'
      : '✅ پست جدید است — ایمپورت نشده',
  })
}
