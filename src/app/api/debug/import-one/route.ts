import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'
import { analyzeWithGemini, normalizePrompt } from '@/lib/gemini'
import { uploadRemoteDirectly } from '@/lib/cloudinary'

export const maxDuration = 60

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 500 })

  const logs: { stage: string; ms: number; ok: boolean; detail?: string }[] = []
  const start = Date.now()
  const log = (stage: string, ok: boolean, detail?: string) => {
    logs.push({ stage, ms: Date.now() - start, ok, detail })
    console.log(`[${stage}] ${ok ? '✓' : '✗'} ${detail ?? ''}`)
  }

  try {
    const item = await prisma.telegramQueue.findFirst({ where: { status: 'PENDING' }, orderBy: { id: 'asc' } })
    if (!item) return NextResponse.json({ ok: false, error: 'no PENDING items', logs })
    log('prisma_find', true, `msgId=${item.id}`)

    let t = Date.now()
    const gf = await (await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${item.img}`, {
      signal: AbortSignal.timeout(5000),
    })).json()
    if (!gf.ok) {
      log('tg_getFile', false, gf.description)
      return NextResponse.json({ ok: false, logs })
    }
    const tgUrl = `https://api.telegram.org/file/bot${token}/${gf.result.file_path}`
    log('tg_getFile', true, `${Date.now() - t}ms`)

    t = Date.now()
    const up = await uploadRemoteDirectly(tgUrl, 'promptsfa/prompts')
    log('cloudinary', true, `${Date.now() - t}ms`)

    const rawText = item.text ?? ''
    const cleanedText = await normalizePrompt(rawText)
    const raw = cleanedText.slice(0, 3000)
    log('clean', true, `${raw.length} chars (normalized from ${rawText.length})`)

    t = Date.now()
    const categories = await prisma.category.findMany({ include: { subs: true } })
    log('prisma_categories', true, `${categories.length} cats`)

    t = Date.now()
    const ai = await analyzeWithGemini({ text: raw, imgBase64: null, categories })
    log('gemini', true, `${Date.now() - t}ms`)

    t = Date.now()
    const cat = categories.find((c) => c.slug === ai.categorySlug) ?? categories[0]
    const sub = ai.subSlug ? cat.subs.find((s) => s.slug === ai.subSlug) ?? null : null
    const slug = 'tg-' + item.id

    await prisma.prompt.create({
      data: {
        slug,
        titleFa: ai.titleFa,
        titleEn: ai.titleEn,
        descFa: ai.descFa,
        descEn: ai.descEn,
        usageFa: ai.usageFa,
        usageEn: ai.usageEn,
        img: up.url,
        model: /--v\s?\d|--ar|midjourney/i.test(raw) ? 'Midjourney' : 'AI',
        type: 'IMAGE',
        status: 'PUBLISHED',
        categoryId: cat.id,
        subId: sub?.id ?? null,
        tagsFa: ai.tagsFa,
        tagsEn: ai.tagsEn,
        prompt: raw,
        views: Math.floor(Math.random() * 10) + 1,
      },
    })
    log('prisma_save', true, `${Date.now() - t}ms`)

    await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'DONE' } })
    log('queue_done', true)

    return NextResponse.json({ ok: true, total_ms: Date.now() - start, logs, slug })
  } catch (e: any) {
    log('error', false, String(e?.message || e))
    return NextResponse.json({ ok: false, error: String(e?.message || e), logs }, { status: 500 })
  }
}
