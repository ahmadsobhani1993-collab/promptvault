#!/bin/bash
set -e

cat > src/app/api/cron/telegram/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchPage, diagnoseChannel, tgSendText, tgSendPhoto, tgSendCode } from '@/lib/telegram'
import { analyzeWithGemini } from '@/lib/gemini'

export const maxDuration = 60

async function getSetting(key: string, def: string) {
  const s = await prisma.setting.findUnique({ where: { key } })
  return s?.value ?? def
}

async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const channel = process.env.TELEGRAM_CHANNEL
  if (!channel) return NextResponse.json({ error: 'no channel env' }, { status: 500 })

  if (searchParams.get('debug') === '1') {
    const d = await diagnoseChannel(channel)
    return NextResponse.json({ debug: d })
  }

  const synced = await getSetting('tg_synced', '0')

  if (synced !== '1') {
    const start = Date.now()
    let before = parseInt(await getSetting('tg_before', '0'), 10)
    let total = 0

    for (let i = 0; i < 12; i++) {
      if (Date.now() - start > 40000) break
      const page = before === 0 ? await fetchPage(channel) : await fetchPage(channel, before)
      if (page.length === 0) {
        await setSetting('tg_synced', '1')
        break
      }
      const minId = Math.min(...page.map((m) => m.id))
      await prisma.telegramQueue.createMany({
        data: page.map((m) => ({ id: m.id, text: m.text, img: m.img, reply: m.reply })),
        skipDuplicates: true,
      })
      total += page.length
      before = minId
      await setSetting('tg_before', String(before))
    }

    return NextResponse.json({
      ok: true,
      phase: 'sync',
      added: total,
      synced: await getSetting('tg_synced', '0'),
      ms: Date.now() - start,
    })
  }

  const item = await prisma.telegramQueue.findFirst({
    where: { status: 'PENDING' },
    orderBy: { id: 'asc' },
  })
  if (!item) return NextResponse.json({ ok: true, phase: 'idle', msg: 'all processed' })

  try {
    let promptText = (item.text ?? '').trim()
    let img = item.img
    const skipIds: number[] = []

    if (img && promptText.length < 40) {
      const next = await prisma.telegramQueue.findFirst({
        where: { id: { gt: item.id }, status: 'PENDING' },
        orderBy: { id: 'asc' },
      })
      if (next && !next.img && (next.text ?? '').length > 40) {
        promptText = (next.text ?? '').trim()
        skipIds.push(next.id)
      }
    }

    if (!img && promptText && item.reply) {
      const prev = await prisma.telegramQueue.findFirst({
        where: { id: { lt: item.id }, img: { not: null } },
        orderBy: { id: 'desc' },
      })
      if (prev && prev.id >= item.id - 3) img = prev.img
    }

    if (!promptText && !img) {
      await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'SKIPPED' } })
      return NextResponse.json({ ok: true, phase: 'skip-empty' })
    }

    let finalImg = img
    let imgBase64: string | null = null
    if (img) {
      const wsrv = 'https://wsrv.nl/?url=' + encodeURIComponent(img) + '&w=900&q=75&output=webp'
      try {
        await fetch(wsrv, { signal: AbortSignal.timeout(9000) })
        finalImg = wsrv
      } catch {}
      try {
        const ir = await fetch(img, { signal: AbortSignal.timeout(8000) })
        const buf = Buffer.from(await ir.arrayBuffer())
        if (buf.length < 4_000_000) imgBase64 = buf.toString('base64')
      } catch {}
    }

    const categories = await prisma.category.findMany()
    const ai = await analyzeWithGemini({
      text: promptText || '(no text — describe the image as a prompt idea)',
      imgBase64,
      categories,
    })
    const cat = await prisma.category.findUnique({ where: { slug: ai.categorySlug } })

    const finalPrompt = (ai.promptEn || promptText).trim()

    const prompt = await prisma.prompt.create({
      data: {
        titleFa: ai.titleFa,
        titleEn: ai.titleEn,
        descFa: ai.descFa,
        descEn: ai.descEn,
        usageFa: ai.usageFa,
        usageEn: ai.usageEn,
        slug: 'tg-' + item.id,
        img: finalImg ?? 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop',
        model: /--v\s?\d|--ar/.test(finalPrompt) ? 'Midjourney' : 'AI',
        type: img ? 'IMAGE' : 'TEXT',
        status: 'PUBLISHED',
        categoryId: cat?.id ?? categories[0].id,
        tagsFa: ai.tagsFa,
        tagsEn: ai.tagsEn,
        prompt: finalPrompt,
      },
    })

    await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'PROCESSED', promptId: prompt.id } })
    for (const sid of skipIds) {
      await prisma.telegramQueue.update({ where: { id: sid }, data: { status: 'MERGED', promptId: prompt.id } })
    }

    // ---------- Telegram output ----------
    let tg: any = null
    const out = process.env.TELEGRAM_OUTPUT
    if (out && process.env.TELEGRAM_BOT_TOKEN) {
      const tagLine = ai.tagsFa.map((t) => '#' + t.replace(/\s+/g, '_')).join(' ')
      const usageFa = (ai.usageFa || '').trim()

      const fullCaption =
        '✨ ' + ai.titleFa + '\n\n' + finalPrompt + '\n\n📘 ' + usageFa + '\n\n' + tagLine

      const shortCaption = '✨ ' + ai.titleFa + '\n\n📘 ' + usageFa + '\n\n' + tagLine

      if (fullCaption.length <= 1024) {
        // همه‌چیز در یک پیام
        tg = {
          single: img
            ? await tgSendPhoto(out, finalImg ?? img, fullCaption)
            : await tgSendText(out, fullCaption),
        }
      } else {
        // پرامپت بلند: عکس+کپشن کوتاه، سپس بلوک کد
        tg = {
          photo: img
            ? await tgSendPhoto(out, finalImg ?? img, shortCaption)
            : await tgSendText(out, shortCaption),
          code: await tgSendCode(out, finalPrompt),
        }
      }
    }

    return NextResponse.json({ ok: true, phase: 'processed', id: item.id, slug: prompt.slug, title: ai.titleFa, tg })
  } catch (e: any) {
    await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'FAILED' } }).catch(() => {})
    return NextResponse.json({ ok: false, phase: 'failed', id: item.id, error: String(e?.message ?? e) }, { status: 500 })
  }
}
EOF

echo "✅ Single-message telegram format with tags + caption!"