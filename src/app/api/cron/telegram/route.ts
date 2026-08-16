import { isCronAuthorized } from '@/lib/cron-auth'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchPage, diagnoseChannel, verifyImage, tgSendText, tgSendPhoto, tgSendCode } from '@/lib/telegram'
import { analyzeWithGemini } from '@/lib/gemini'

export const maxDuration = 60

const TG_FOOTER = '\n\n🔗 @Prompts_fa'

async function getSetting(key: string, def: string) {
  const s = await prisma.setting.findUnique({ where: { key } })
  return s?.value ?? def
}

async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
}

function tehranNow() {
  const now = new Date()
  const hour = parseInt(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: 'numeric', hour12: false }).format(now),
    10
  )
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now)
  return { hour, date }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  // Vercel Cron خودش header authorization می‌فرستد؛ دستی هم با key قابل دسترسی است
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

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

    let imgBase64: string | null = null
    if (img) {
      try {
        const ir = await fetch(img, { signal: AbortSignal.timeout(8000) })
        const buf = Buffer.from(await ir.arrayBuffer())
        if (buf.length < 4_000_000) imgBase64 = buf.toString('base64')
      } catch {}
    }

    let finalImg: string | null = null
    if (img) {
      const wsrv = 'https://wsrv.nl/?url=' + encodeURIComponent(img) + '&w=900&q=75&output=webp'
      const st = 'https://cdn.statically.io/img/' + img.replace(/^https?:\/\//, '')
      if (await verifyImage(wsrv)) finalImg = wsrv
      else if (await verifyImage(st)) finalImg = st
    }

    if (!finalImg) {
      await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'SKIPPED' } })
      for (const sid of skipIds) {
        await prisma.telegramQueue.update({ where: { id: sid }, data: { status: 'SKIPPED' } })
      }
      return NextResponse.json({ ok: true, phase: 'skip-no-image', id: item.id })
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
        img: finalImg,
        model: /--v\s?\d|--ar/.test(finalPrompt) ? 'Midjourney' : 'AI',
        type: 'IMAGE',
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

    let tg: any = null
    const out = process.env.TELEGRAM_OUTPUT
    if (out && process.env.TELEGRAM_BOT_TOKEN) {
      const { hour, date } = tehranNow()
      const sentDate = await getSetting('tg_sent_date', '')
      let sentCount = sentDate === date ? parseInt(await getSetting('tg_sent_count', '0'), 10) : 0
      const inWindow = hour >= 12 && hour <= 23

      if (!inWindow) {
        tg = { skipped: true, reason: 'outside Tehran window (12:00-23:59). current hour: ' + hour }
      } else if (sentCount >= 24) {
        tg = { skipped: true, reason: 'daily limit 24 reached' }
      } else {
        const tagLine = ai.tagsFa.map((t) => '#' + t.replace(/\s+/g, '_')).join(' ')
        const usageFa = (ai.usageFa || '').trim()

        const fullCaption =
          '✨ ' + ai.titleFa + '\n\n' + finalPrompt + '\n\n📘 ' + usageFa + '\n\n' + tagLine + TG_FOOTER

        const shortCaption = '✨ ' + ai.titleFa + '\n\n📘 ' + usageFa + '\n\n' + tagLine + TG_FOOTER

        if (fullCaption.length <= 1024) {
          tg = { single: await tgSendPhoto(out, finalImg, fullCaption) }
        } else {
          tg = {
            photo: await tgSendPhoto(out, finalImg, shortCaption),
            code: await tgSendCode(out, finalPrompt, TG_FOOTER),
          }
        }

        await setSetting('tg_sent_date', date)
        await setSetting('tg_sent_count', String(sentCount + 1))
      }
    }

    return NextResponse.json({ ok: true, phase: 'processed', id: item.id, slug: prompt.slug, title: ai.titleFa, tg })
  } catch (e: any) {
    await prisma.telegramQueue.update({ where: { id: item.id }, data: { status: 'FAILED' } }).catch(() => {})
    return NextResponse.json({ ok: false, phase: 'failed', id: item.id, error: String(e?.message ?? e) }, { status: 500 })
  }
}
