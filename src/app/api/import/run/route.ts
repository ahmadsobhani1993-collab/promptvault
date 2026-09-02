import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeWithGemini, normalizePrompt } from '@/lib/gemini'
import { isCronAuthorized } from '@/lib/cron-auth'
import { uploadToCloudinary } from '@/lib/cloudinary'

export const maxDuration = 60

async function getSetting(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}
async function setSetting(k: string, v: string) {
  await prisma.setting.upsert({ where: { key: k }, update: { value: v }, create: { key: k, value: v } })
}

function extractPrompt(text: string): string {
  const t = text.trim()
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const j = JSON.parse(t)
      if (j.prompt || j.text || j.content) return String(j.prompt || j.text || j.content)
      return JSON.stringify(j)
    } catch {}
  }
  return t
}

function cleanText(t: string): string {
  return t
    .replace(/@[\w]+/g, '')
    .replace(/✨[^\n]*✨/g, '')
    .replace(/\(?[^)\n]*پرامپت در پیام بعد[^)\n]*\)?/g, '')
    .replace(/کانال پرامپت ذخیره/g, '')
    .replace(/پرامپت هوشمند/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const q = new URL(req.url).searchParams
  const count = Math.min(10, parseInt(q.get('count') || '3', 10))
  const force = q.get('force') === '1'

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })
  const api = (m: string, p?: Record<string, string>) =>
    `https://api.telegram.org/bot${token}/${m}${p ? '?' + new URLSearchParams(p) : ''}`

  let chatId = await getSetting('tg_chat_id', '')
  if (!chatId) {
    const c = await (await fetch(api('getChat', { chat_id: '@Prompts_fa' }))).json()
    if (!c.ok) return NextResponse.json({ error: 'getChat failed' }, { status: 500 })
    chatId = String(c.result.id)
    await setSetting('tg_chat_id', chatId)
  }
  const privChat = await getSetting('tg_private_chat', '')
  if (!privChat) return NextResponse.json({ error: 'send /start to bot' }, { status: 400 })

  let cursor = parseInt(q.get('from') || (await getSetting('import_cursor2', '1')), 10)
  const categories = await prisma.category.findMany({ include: { subs: true } })
  const results: any[] = []
  let imported = 0
  let processed = 0
  const MAX_SCAN = 200

  for (let msgId = cursor; imported < count && processed < MAX_SCAN; msgId++, processed++) {
    try {
      const slug = 'tg-' + msgId
      if (!force && (await prisma.prompt.findUnique({ where: { slug } }))) { results.push({ msgId, skip: 'exists' }); continue }

      const f1 = await (await fetch(api('forwardMessage', { chat_id: privChat, from_chat_id: chatId, message_id: String(msgId) }))).json()
      if (!f1.ok || !f1.result?.photo) {
        if (f1.description?.includes('MESSAGE_ID_INVALID')) {
          // به آخر کانال رسیدیم
          break
        }
        results.push({ msgId, skip: 'no photo' })
        continue
      }
      const photoMsg = f1.result
      const fwd1 = photoMsg.message_id

      let raw = (photoMsg.caption || '').trim()
      let fwd2: number | null = null

      if (raw.length < 60) {
        const f2 = await (await fetch(api('forwardMessage', { chat_id: privChat, from_chat_id: chatId, message_id: String(msgId + 1) }))).json()
        if (f2.ok && f2.result) {
          const nm = f2.result
          fwd2 = nm.message_id
          const isReply = nm.reply_to_message?.message_id === msgId
          const txt = (nm.text || nm.caption || '').trim()
          if ((isReply || (!nm.photo && txt.length > 60)) && txt.length > raw.length) raw = txt
        }
      }

      for (const id of [fwd1, fwd2]) if (id) await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(id) })).catch(() => {})

      raw = cleanText(extractPrompt(raw))
      if (raw.length < 20) { results.push({ msgId, skip: 'no prompt' }); continue }

      const fileId = photoMsg.photo[photoMsg.photo.length - 1].file_id
      const gf = await (await fetch(api('getFile', { file_id: fileId }))).json()
      if (!gf.ok) { results.push({ msgId, skip: 'getFile failed' }); continue }
      const imgBuf = Buffer.from(await (await fetch(`https://api.telegram.org/file/bot${token}/${gf.result.file_path}`)).arrayBuffer())

      // آپلود به Cloudinary
      const up = await uploadToCloudinary(imgBuf, 'promptsfa/prompts')

      const clean = await normalizePrompt(raw).catch(() => raw)
      const ai = await analyzeWithGemini({ text: clean, imgBase64: null, categories })
      const cat = categories.find((c) => c.slug === ai.categorySlug) ?? categories[0]
      const sub = ai.subSlug ? cat.subs.find((s) => s.slug === ai.subSlug) ?? null : null
      const finalPrompt = (ai.promptEn || clean).trim()

      const data = {
        titleFa: ai.titleFa,
        titleEn: ai.titleEn,
        descFa: ai.descFa,
        descEn: ai.descEn,
        usageFa: ai.usageFa,
        usageEn: ai.usageEn,
        img: up.url,
        model: /--v\s?\d|--ar|midjourney/i.test(finalPrompt) ? 'Midjourney' : 'AI',
        type: 'IMAGE' as const,
        status: 'PUBLISHED' as const,
        categoryId: cat.id,
        subId: sub?.id ?? null,
        tagsFa: ai.tagsFa,
        tagsEn: ai.tagsEn,
        prompt: finalPrompt,
        views: 1 + Math.floor(Math.random() * 10),
      }

      const existing = await prisma.prompt.findUnique({ where: { slug } })
      let promptId: string
      if (existing && force) {
        await prisma.prompt.update({ where: { id: existing.id }, data })
        promptId = existing.id
      } else {
        const created = await prisma.prompt.create({ data: { ...data, slug } })
        promptId = created.id
      }
      await prisma.promptImage.upsert({
        where: { promptId },
        update: { data: up.publicId, type: 'cloudinary' },
        create: { promptId, data: up.publicId, type: 'cloudinary' },
      }).catch(() => {})

      imported++
      results.push({ msgId, slug, cat: cat.slug, sub: sub?.slug ?? null, img: up.url.slice(0, 60) })
    } catch (e: any) {
      results.push({ msgId, error: String(e?.message || e) })
    }
  }

  await setSetting('import_cursor2', String(cursor + processed))

  return NextResponse.json({
    ok: true,
    imported,
    processed,
    nextCursor: cursor + processed,
    results,
  })
}
