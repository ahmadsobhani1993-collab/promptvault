import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchPage, tgSendText, tgSendFile } from '@/lib/telegram'
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
  if (!channel) return NextResponse.json({ error: 'no channel' }, { status: 500 })

  const synced = await getSetting('tg_synced', '0')

  // ---------- PHASE 1: build queue from oldest post ----------
  if (synced !== '1') {
    let before = parseInt(await getSetting('tg_before', '0'), 10)

    if (before === 0) {
      const first = await fetchPage(channel)
      if (first.length === 0) return NextResponse.json({ ok: true, phase: 'sync', msg: 'empty channel' })
      const minId = Math.min(...first.map((m) => m.id))
      for (const msg of first) {
        await prisma.telegramQueue.upsert({
          where: { id: msg.id },
          update: {},
          create: { id: msg.id, text: msg.text, img: msg.img, reply: msg.reply },
        })
      }
      before = minId
      await setSetting('tg_before', String(before))
    }

    const page = await fetchPage(channel, before)
    if (page.length === 0) {
      await setSetting('tg_synced', '1')
      return NextResponse.json({ ok: true, phase: 'sync-done' })
    }

    const minId = Math.min(...page.map((m) => m.id))
    for (const msg of page) {
      await prisma.telegramQueue.upsert({
        where: { id: msg.id },
        update: {},
        create: { id: msg.id, text: msg.text, img: msg.img, reply: msg.reply },
      })
    }
    await setSetting('tg_before', String(minId))
    return NextResponse.json({ ok: true, phase: 'sync', got: page.length, before: minId })
  }

  // ---------- PHASE 2: process one post per tick ----------
  const item = await prisma.telegramQueue.findFirst({
    where: { status: 'PENDING' },
    orderBy: { id: 'asc' },
  })
  if (!item) return NextResponse.json({ ok: true, phase: 'idle', msg: 'all processed' })

  try {
    let promptText = item.text ?? ''
    let img = item.img
    const skipIds: number[] = []

    // reply/continuation detection: photo without text + next message with text
    if (img && promptText.length < 40) {
      const next = await prisma.telegramQueue.findFirst({
        where: { id: { gt: item.id }, status: 'PENDING' },
        orderBy: { id: 'asc' },
      })
      if (next && !next.img && (next.text ?? '').length > 40) {
        promptText = next.text ?? ''
        skipIds.push(next.id)
      }
    }
    // text-only reply to a photo above
    if (!img && promptText && item.reply) {
      const prev = await prisma.telegramQueue.findFirst({
        where: { id: { lt: item.id }, img: { not: null } },
        orderBy: { id: 'desc' },
      })
      if (prev && prev.id >= item.id - 3) {
        img = prev.img
      }
    }

    if (!promptText && !img) {
      await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'SKIPPED' } })
      return NextResponse.json({ ok: true, phase: 'skip-empty' })
    }

    // download image for Gemini
    let imgBase64: string | null = null
    if (img) {
      try {
        const ir = await fetch(img)
        const buf = Buffer.from(await ir.arrayBuffer())
        if (buf.length < 4_000_000) imgBase64 = buf.toString('base64')
      } catch {}
    }

    const categories = await prisma.category.findMany()
    const ai = await analyzeWithGemini({ text: promptText, imgBase64, categories })

    const cat = await prisma.category.findUnique({ where: { slug: ai.categorySlug } })

    const prompt = await prisma.prompt.create({
      data: {
        titleFa: ai.titleFa,
        titleEn: ai.titleEn,
        descFa: ai.descFa,
        descEn: ai.descEn,
        usageFa: ai.usageFa,
        usageEn: ai.usageEn,
        slug: 'tg-' + item.id,
        img: img ?? 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop',
        model: /--v\s?\d|--ar/.test(promptText) ? 'Midjourney' : 'AI',
        type: img ? 'IMAGE' : 'TEXT',
        status: 'PUBLISHED',
        categoryId: cat?.id ?? categories[0].id,
        tagsFa: ai.tagsFa,
        tagsEn: ai.tagsEn,
        prompt: promptText || ai.titleEn,
      },
    })

    await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'PROCESSED', promptId: prompt.id } })
    for (const sid of skipIds) {
      await prisma.telegramQueue.update({ where: { id: sid }, data: { status: 'MERGED', promptId: prompt.id } })
    }

    // ---------- send formatted version back to Telegram ----------
    const out = process.env.TELEGRAM_OUTPUT
    if (out && process.env.TELEGRAM_BOT_TOKEN) {
      await tgSendText(out, '✨ ' + ai.titleFa)
      await tgSendFile(out, 'prompt-' + item.id + '.txt', promptText || ai.titleEn)
      await tgSendText(
        out,
        '📘 راهنمای استفاده:\n' + (ai.usageFa || '—') + '\n\n📘 How to use:\n' + (ai.usageEn || '—') + '\n\n🆔 ' + out + ' ⭐'
      )
    }

    return NextResponse.json({ ok: true, phase: 'processed', id: item.id, slug: prompt.slug })
  } catch (e: any) {
    await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'FAILED' } }).catch(() => {})
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 })
  }
}
