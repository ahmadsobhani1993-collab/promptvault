export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'
import { analyzeBatchWithGemini } from '@/lib/gemini'
import { uploadRemoteDirectly } from '@/lib/cloudinary'

export const maxDuration = 300

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
    const queueItems = await prisma.telegramQueue.findMany({
      where: { status: { in: ['PENDING', 'APPROVED'] } },
      orderBy: { id: 'asc' },
      take: 10,
    })

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({ ok: true, done: true, message: 'صف خالی است', logs })
    }

    log('queue_fetch', true, `fetched ${queueItems.length} items`)

    const itemIds = queueItems.map((item) => item.id)
    await prisma.telegramQueue.updateMany({
      where: { id: { in: itemIds } },
      data: { status: 'PROCESSING' },
    })

    const categories = await prisma.category.findMany({ include: { subs: true } })
    log('prisma_categories', true, `${categories.length} cats`)

    const uploadResults = await Promise.allSettled(
      queueItems.map(async (item) => {
        const gfRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${item.img}`, {
          signal: AbortSignal.timeout(15000),
        })
        const gf = await gfRes.json()
        if (!gf.ok) throw new Error(gf.description || 'tg file not found')

        const tgUrl = `https://api.telegram.org/file/bot${token}/${gf.result.file_path}`
        const isVideo = /\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(gf.result.file_path || '')
        const up = await uploadRemoteDirectly(
          tgUrl,
          isVideo ? 'promptsfa/videos' : 'promptsfa/prompts',
          `tg-${item.id}`,
          isVideo ? 'video' : 'image'
        )

        return {
          id: item.id,
          rawText: item.text ?? '',
          imgUrl: up?.url || 'https://placehold.co/600x400/1a1a1a/FFF/png?text=Prompt',
          isVideo,
        }
      })
    )

    const validItems: { id: number; rawText: string; imgUrl: string; isVideo: boolean }[] = []
    const failedIds: number[] = []

    uploadResults.forEach((res, idx) => {
      const originalId = queueItems[idx].id
      if (res.status === 'fulfilled') {
        validItems.push(res.value)
      } else {
        failedIds.push(originalId)
        log('upload_failed', false, `item ${originalId}: ${res.reason?.message}`)
      }
    })

    if (failedIds.length > 0) {
      await prisma.telegramQueue.updateMany({
        where: { id: { in: failedIds } },
        data: { status: 'FAILED' },
      })
    }

    if (validItems.length === 0) {
      return NextResponse.json({ ok: false, error: 'all uploads failed', logs }, { status: 500 })
    }

    const tGemini = Date.now()
    const batchInput = validItems.map((it) => ({ id: it.id, rawText: it.rawText }))
    const aiResults = await analyzeBatchWithGemini({ items: batchInput, categories })
    log('gemini_batch', true, `${Date.now() - tGemini}ms for ${aiResults.length} items`)

    const importedSlugs: string[] = []

    for (const validItem of validItems) {
      const ai = aiResults.find((r) => String(r.id) === String(validItem.id))
      const cleanPrompt = ai?.cleanPrompt || validItem.rawText
      const titleFa = ai?.titleFa || `پرامپت ${validItem.id}`
      const titleEn = ai?.titleEn || 'AI Prompt'

      const cat = categories.find((c) => c.slug === ai?.categorySlug) ?? categories[0]
      const sub = ai?.subSlug ? cat?.subs?.find((s) => s.slug === ai.subSlug) ?? null : null

      let slug = `tg-${validItem.id}`

      const promptData = {
        titleFa,
        titleEn,
        descFa: ai?.descFa || '',
        descEn: ai?.descEn || '',
        usageFa: ai?.usageFa || '',
        usageEn: ai?.usageEn || '',
        img: validItem.imgUrl,
        model: /--v\s?\d|--ar|midjourney/i.test(cleanPrompt) ? 'Midjourney' : 'AI',
        type: (validItem.isVideo ? 'VIDEO' : 'IMAGE') as 'VIDEO' | 'IMAGE',
        status: 'PUBLISHED' as const,
        categoryId: cat.id,
        subId: sub?.id ?? null,
        tagsFa: ai?.tagsFa || [],
        tagsEn: ai?.tagsEn || [],
        prompt: cleanPrompt,
        views: Math.floor(Math.random() * 10) + 1,
      }

      try {
        await prisma.prompt.create({ data: { ...promptData, slug } })
      } catch (err: any) {
        if (String(err?.message || '').includes('Unique constraint')) {
          slug = `tg-${validItem.id}-${Date.now()}`
          await prisma.prompt.create({ data: { ...promptData, slug } })
        } else {
          throw err
        }
      }

      await prisma.telegramQueue.update({
        where: { id: validItem.id },
        data: { status: 'DONE' },
      })

      importedSlugs.push(slug)
    }

    log('queue_done', true, `imported: ${importedSlugs.join(', ')}`)

    return NextResponse.json({
      ok: true,
      count: importedSlugs.length,
      slugs: importedSlugs,
      slug: importedSlugs[0] || null,
      total_ms: Date.now() - start,
      logs,
    })
  } catch (e: any) {
    const errorMsg = String(e?.message || e)
    log('error', false, errorMsg)
    return NextResponse.json({ ok: false, error: errorMsg, logs }, { status: 500 })
  }
}
