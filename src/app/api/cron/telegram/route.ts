import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { tgSendText, tgSendPhoto, tgSendCode } from '@/lib/telegram'
import { analyzeWithGemini } from '@/lib/gemini'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60

const TG_FOOTER = '\n\n🔗 @Prompts_fa'
const APP = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'

async function getSetting(key: string, def: string) {
  const s = await prisma.setting.findUnique({ where: { key } })
  return s?.value ?? def
}
async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
}
function tehranNow() {
  const now = new Date()
  const hour = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: 'numeric', hour12: false }).format(now), 10)
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now)
  return { hour, date }
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no bot token' }, { status: 500 })
  const api = (m: string, q?: Record<string, string>) =>
    'https://api.telegram.org/bot' + token + '/' + m + (q ? '?' + new URLSearchParams(q).toString() : '')

  const channelUser = process.env.TELEGRAM_CHANNEL ?? 'Prompts_fa'

  // clean old scraping queue once
  if ((await getSetting('tg_queue_cleaned', '0')) !== '1') {
    await prisma.telegramQueue.updateMany({ where: { status: 'PENDING' }, data: { status: 'SKIPPED' } }).catch(() => {})
    await setSetting('tg_queue_cleaned', '1')
  }

  // channel id
  let chatId = await getSetting('tg_chat_id', '')
  if (!chatId) {
    const cr = await (await fetch(api('getChat', { chat_id: '@' + channelUser }), { signal: AbortSignal.timeout(8000) })).json()
    if (!cr.ok) return NextResponse.json({ ok: false, error: 'getChat failed: ' + (cr.description ?? '') }, { status: 500 })
    chatId = String(cr.result.id)
    await setSetting('tg_chat_id', chatId)
  }

  // get new channel posts
  let offset = parseInt(await getSetting('tg_update_offset2', '0'), 10)
  const ur = await (await fetch(api('getUpdates', { offset: String(offset), limit: '100', timeout: '3' }), { signal: AbortSignal.timeout(30000) })).json()
  const ups: any[] = ur.result ?? []

  const posts: any[] = []
  for (const u of ups) {
    const p = u.channel_post
    if (p && String(p.chat.id) === chatId) posts.push(p)
    if (u.update_id + 1 > offset) offset = u.update_id + 1
  }
  await setSetting('tg_update_offset2', String(offset))

  if (!posts.length) return NextResponse.json({ ok: true, phase: 'idle', offset })

  // merge photo + following long text
  const merged: { id: number; text: string; fileId: string | null }[] = []
  for (let i = 0; i < posts.length; i++) {
    const cur = posts[i]
    const next = posts[i + 1]
    const curText = (cur.caption || cur.text || '').trim()
    const fileId = cur.photo?.length ? cur.photo[cur.photo.length - 1].file_id : null
    if (fileId && curText.length < 60 && next && !next.photo && ((next.text || next.caption || '').trim().length > 60)) {
      merged.push({ id: cur.message_id, text: (next.text || next.caption).trim(), fileId })
      i++
    } else {
      merged.push({ id: cur.message_id, text: curText, fileId })
    }
  }

  const results: any[] = []
  for (const m of merged.slice(0, 2)) {
    if (!m.fileId || !m.text) { results.push({ id: m.id, skipped: 'no image or text' }); continue }

    // download full image via Bot API
    let imgBase64: string | null = null
    let imgType = 'image/jpeg'
    try {
      const fr = await (await fetch(api('getFile', { file_id: m.fileId }), { signal: AbortSignal.timeout(10000) })).json()
      const path = fr.result?.file_path
      if (path) {
        const fileUrl = 'https://api.telegram.org/file/bot' + token + '/' + path
        const ir = await fetch(fileUrl, { signal: AbortSignal.timeout(20000) })
        const buf = Buffer.from(await ir.arrayBuffer())
        if (ir.ok && buf.length > 5000 && buf.length < 2_500_000) {
          imgBase64 = buf.toString('base64')
          imgType = path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
        }
      }
    } catch {}

    if (!imgBase64) { results.push({ id: m.id, skipped: 'image download failed' }); continue }

    try {
      const categories = await prisma.category.findMany()
      let ai
      try {
        ai = await analyzeWithGemini({ text: m.text, imgBase64, imgMime: imgType, categories })
      } catch {
        ai = await analyzeWithGemini({ text: m.text, imgBase64: null, categories })
      }

      const cat = await prisma.category.findUnique({ where: { slug: ai.categorySlug } })
      const finalPrompt = (ai.promptEn || m.text).trim()

      const prompt = await prisma.prompt.create({
        data: {
          titleFa: ai.titleFa, titleEn: ai.titleEn, descFa: ai.descFa, descEn: ai.descEn,
          usageFa: ai.usageFa, usageEn: ai.usageEn,
          slug: 'tg-' + m.id,
          img: APP() + '/api/img/new-' + m.id,
          model: /--v\s?\d|--ar/.test(finalPrompt) ? 'Midjourney' : 'AI',
          type: 'IMAGE', status: 'PUBLISHED',
          categoryId: cat?.id ?? categories[0].id,
          tagsFa: ai.tagsFa, tagsEn: ai.tagsEn, prompt: finalPrompt,
          imgData: imgBase64, imgType,
        },
      })
      await prisma.prompt.update({ where: { id: prompt.id }, data: { img: APP() + '/api/img/' + prompt.id } })

      // send to output channel
      let tg: any = null
      const out = process.env.TELEGRAM_OUTPUT
      if (out) {
        const { hour, date } = tehranNow()
        const sentDate = await getSetting('tg_sent_date', '')
        let sentCount = sentDate === date ? parseInt(await getSetting('tg_sent_count', '0'), 10) : 0
        if (hour >= 12 && hour <= 23 && sentCount < 24) {
          const tagLine = ai.tagsFa.map((t) => '#' + t.replace(/\s+/g, '_')).join(' ')
          const usageFa = (ai.usageFa || '').trim()
          const full = '✨ ' + ai.titleFa + '\n\n' + finalPrompt + '\n\n📘 ' + usageFa + '\n\n' + tagLine + TG_FOOTER
          const short = '✨ ' + ai.titleFa + '\n\n📘 ' + usageFa + '\n\n' + tagLine + TG_FOOTER
          const selfUrl = APP() + '/api/img/' + prompt.id
          if (full.length <= 1024) tg = { single: await tgSendPhoto(out, selfUrl, full) }
          else tg = { photo: await tgSendPhoto(out, selfUrl, short), code: await tgSendCode(out, finalPrompt, TG_FOOTER) }
          await setSetting('tg_sent_date', date)
          await setSetting('tg_sent_count', String(sentCount + 1))
        } else tg = { skipped: true, hour }
      }

      results.push({ id: m.id, slug: prompt.slug, published: true, tg })
    } catch (e: any) {
      results.push({ id: m.id, error: String(e?.message ?? e) })
    }
  }

  return NextResponse.json({ ok: true, phase: 'processed', newPosts: posts.length, results })
}
