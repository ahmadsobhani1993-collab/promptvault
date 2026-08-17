import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeWithGemini } from '@/lib/gemini'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60
const APP = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://promptsfa.ir'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })
  const api = (m: string, q?: Record<string, string>) =>
    'https://api.telegram.org/bot' + token + '/' + m + (q ? '?' + new URLSearchParams(q).toString() : '')

  const { searchParams } = new URL(req.url)
  const count = Math.min(parseInt(searchParams.get('count') ?? '3', 10) || 3, 5)

  let chatId = (await prisma.setting.findUnique({ where: { key: 'tg_chat_id' } }))?.value ?? ''
  if (!chatId) {
    const cr = await (await fetch(api('getChat', { chat_id: '@' + (process.env.TELEGRAM_CHANNEL ?? 'Prompts_fa') }), { signal: AbortSignal.timeout(8000) })).json()
    if (!cr.ok) return NextResponse.json({ error: 'getChat failed' }, { status: 500 })
    chatId = String(cr.result.id)
    await prisma.setting.upsert({ where: { key: 'tg_chat_id' }, update: { value: chatId }, create: { key: 'tg_chat_id', value: chatId } })
  }

  let priv = (await prisma.setting.findUnique({ where: { key: 'tg_private_chat' } }))?.value ?? ''
  if (!priv) {
    const ur = await (await fetch(api('getUpdates', { limit: '100' }), { signal: AbortSignal.timeout(10000) })).json()
    for (const u of ur.result ?? []) {
      if (u.message?.chat?.type === 'private') { priv = String(u.message.chat.id); break }
    }
    if (!priv) return NextResponse.json({ error: 'اول در تلگرام به @pickeepersbot پیام /start بفرست، بعد دوباره بزن' }, { status: 400 })
    await prisma.setting.upsert({ where: { key: 'tg_private_chat' }, update: { value: priv }, create: { key: 'tg_private_chat', value: priv } })
  }

  let cursor = parseInt((await prisma.setting.findUnique({ where: { key: 'import_cursor' } }))?.value ?? '100', 10)

  const results: any[] = []
  const categories = await prisma.category.findMany()

  for (let n = 0; n < count; n++) {
    const f1 = await (await fetch(api('forwardMessage', { chat_id: priv, from_chat_id: chatId, message_id: String(cursor) }), { signal: AbortSignal.timeout(10000) })).json()
    if (!f1.ok) { cursor++; continue }
    const m1 = f1.result
    const fwdIds: number[] = [m1.message_id]
    let text = (m1.caption || m1.text || '').trim()
    let fileId = m1.photo?.length ? m1.photo[m1.photo.length - 1].file_id : null
    let advanced = 1

    if (fileId && text.length < 60) {
      for (let off = 1; off <= 3; off++) {
        const f2 = await (await fetch(api('forwardMessage', { chat_id: priv, from_chat_id: chatId, message_id: String(cursor + off) }), { signal: AbortSignal.timeout(10000) })).json()
        if (f2.ok && !f2.result.photo && (f2.result.text || '').trim().length > 60) {
          text = f2.result.text.trim()
          fwdIds.push(f2.result.message_id)
          advanced = off + 1
          break
        }
        if (f2.ok) { await fetch(api('deleteMessage', { chat_id: priv, message_id: String(f2.result.message_id) })).catch(() => {}) }
        if (!f2.ok) break
      }
    }

    for (const fid of fwdIds) await fetch(api('deleteMessage', { chat_id: priv, message_id: String(fid) })).catch(() => {})

    if (!fileId || !text) { cursor += advanced; continue }

    let imgBase64: string | null = null
    const imgType = 'image/jpeg'
    const fr = await (await fetch(api('getFile', { file_id: fileId }), { signal: AbortSignal.timeout(10000) })).json()
    if (fr.result?.file_path) {
      const ir = await fetch('https://api.telegram.org/file/bot' + token + '/' + fr.result.file_path, { signal: AbortSignal.timeout(20000) })
      const buf = Buffer.from(await ir.arrayBuffer())
      if (buf.length > 5000 && buf.length < 2_500_000) imgBase64 = buf.toString('base64')
    }
    if (!imgBase64) { cursor += advanced; results.push({ id: cursor, skipped: 'img' }); continue }

    try {
      let ai
      try { ai = await analyzeWithGemini({ text, imgBase64, imgMime: imgType, categories }) }
      catch { ai = await analyzeWithGemini({ text, imgBase64: null, categories }) }
      const cat = await prisma.category.findUnique({ where: { slug: ai.categorySlug } })
      const finalPrompt = (ai.promptEn || text).trim()
      const prompt = await prisma.prompt.create({
        data: {
          titleFa: ai.titleFa, titleEn: ai.titleEn, descFa: ai.descFa, descEn: ai.descEn,
          usageFa: ai.usageFa, usageEn: ai.usageEn,
          slug: 'tg-' + cursor,
          img: APP() + '/api/img/tmp-' + cursor,
          model: /--v\s?\d|--ar/.test(finalPrompt) ? 'Midjourney' : 'AI',
          type: 'IMAGE', status: 'PUBLISHED',
          categoryId: cat?.id ?? categories[0].id,
          tagsFa: ai.tagsFa, tagsEn: ai.tagsEn, prompt: finalPrompt,
                    views: 1 + Math.floor(Math.random() * 10),
        },
      })
      await prisma.prompt.update({ where: { id: prompt.id }, data: { img: APP() + '/api/img/' + prompt.id } })
      await prisma.promptImage.create({ data: { promptId: prompt.id, data: imgBase64, type: imgType } }).catch(() => {})
      results.push({ id: cursor, slug: prompt.slug, published: true })
    } catch (e: any) {
      results.push({ id: cursor, error: String(e?.message ?? e) })
    }

    cursor += advanced
  }

  await prisma.setting.upsert({ where: { key: 'import_cursor' }, update: { value: String(cursor) }, create: { key: 'import_cursor', value: String(cursor) } })

  const zeros = await prisma.prompt.findMany({ where: { views: 0 }, select: { id: true }, take: 200 })
  for (const z of zeros) {
    await prisma.prompt.update({ where: { id: z.id }, data: { views: 1 + Math.floor(Math.random() * 10) } })
  }

  return NextResponse.json({ ok: true, cursor, results, fixedViews: zeros.length })
}
