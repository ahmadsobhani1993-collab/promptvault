export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeWithGemini, normalizePrompt } from '@/lib/gemini'
import { isCronAuthorized } from '@/lib/cron-auth'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

export const maxDuration = 60

const s3 = new S3Client({
  region: 'default',
  endpoint: 'https://' + (process.env.ARVAN_ENDPOINT || 's3.ir-thr-at1.arvanstorage.ir'),
  credentials: {
    accessKeyId: process.env.ARVAN_ACCESS_KEY || '',
    secretAccessKey: process.env.ARVAN_SECRET_KEY || '',
  },
})

const BUCKET = process.env.ARVAN_BUCKET || 'promptfa'

async function uploadToArvan(buffer: Buffer, key: string): Promise<string> {
  const webpBuffer = await sharp(buffer)
    .webp({ quality: 82 })
    .toBuffer()

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: webpBuffer,
      ContentType: 'image/webp',
      ACL: 'public-read',
    })
  )

  return `https://${BUCKET}.${process.env.ARVAN_ENDPOINT || 's3.ir-thr-at1.arvanstorage.ir'}/${key}`
}

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
  const count = Math.min(5, parseInt(q.get('count') || '2', 10))
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
  const MAX_SCAN = 150

  let lastProcessedId = cursor

  for (let msgId = cursor; imported < count && processed < MAX_SCAN; msgId++, processed++) {
    lastProcessedId = msgId
    try {
      const slug = 'tg-' + msgId
      if (!force && (await prisma.prompt.findUnique({ where: { slug } }))) {
        results.push({ msgId, skip: 'exists' })
        continue
      }

      const f1 = await (await fetch(api('forwardMessage', { chat_id: privChat, from_chat_id: chatId, message_id: String(msgId) }))).json()
      if (!f1.ok || !f1.result?.photo) {
        if (f1.description?.includes('MESSAGE_ID_INVALID')) {
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

      for (const id of [fwd1, fwd2]) {
        if (id) await fetch(api('deleteMessage', { chat_id: privChat, message_id: String(id) })).catch(() => {})
      }

      raw = cleanText(extractPrompt(raw))
      if (raw.length < 20) {
        results.push({ msgId, skip: 'no prompt text' })
        continue
      }

      const fileId = photoMsg.photo[photoMsg.photo.length - 1].file_id
      const gf = await (await fetch(api('getFile', { file_id: fileId }))).json()
      if (!gf.ok) {
        results.push({ msgId, skip: 'getFile failed' })
        continue
      }

      const imgBuf = Buffer.from(await (await fetch(`https://api.telegram.org/file/bot${token}/${gf.result.file_path}`)).arrayBuffer())
      const arvanKey = `prompts/${slug}-${Date.now()}.webp`
      const uploadedImgUrl = await uploadToArvan(imgBuf, arvanKey)

      const normalized = normalizePrompt(raw)
      const aiData = await analyzeWithGemini(raw, categories).catch(() => null)

      let categoryId = categories[0]?.id || ''
      let subId = null
      if (aiData?.categorySlug) {
        const foundCat = categories.find((c) => c.slug === aiData.categorySlug)
        if (foundCat) {
          categoryId = foundCat.id
          if (aiData.subSlug && foundCat.subs) {
            const foundSub = foundCat.subs.find((s: any) => s.slug === aiData.subSlug)
            if (foundSub) subId = foundSub.id
          }
        }
      }

      await prisma.prompt.create({
        data: {
          slug,
          prompt: normalized,
          titleFa: aiData?.titleFa || `پرامپت ${msgId}`,
          titleEn: aiData?.titleEn || `Prompt ${msgId}`,
          descFa: aiData?.descFa || '',
          descEn: aiData?.descEn || '',
          usageFa: aiData?.usageFa || '',
          usageEn: aiData?.usageEn || '',
          model: aiData?.model || 'Midjourney',
          type: (aiData?.type as any) || 'IMAGE',
          img: uploadedImgUrl,
          tagsFa: aiData?.tagsFa || [],
          tagsEn: aiData?.tagsEn || [],
          categoryId,
          subId,
          status: 'PUBLISHED',
        },
      })

      imported++
      results.push({ msgId, status: 'imported', slug })
    } catch (err: any) {
      results.push({ msgId, error: err.message || 'unknown error' })
    }
  }

  const nextCursor = lastProcessedId + 1
  await setSetting('import_cursor2', String(nextCursor))

  return NextResponse.json({
    imported,
    processed,
    currentCursor: cursor,
    nextCursor,
    results,
  })
}
