import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'
import { analyzeWithGemini } from '@/lib/gemini'

export const maxDuration = 60

const CHANNEL = 'promptsfa1'
const DEFAULT_IMG = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&q=80'

async function getSetting(k: string, d: string) {
  return (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? d
}
async function setSetting(k: string, v: string) {
  await prisma.setting.upsert({ where: { key: k }, update: { value: v }, create: { key: k, value: v } })
}

// scrape پست‌های public از t.me/s/channel
async function scrapePosts(fromId: number, count: number): Promise<any[]> {
  // t.me/s/channel از آخرین پست‌ها نشان می‌دهد
  // می‌توانیم با from=ID یا از طریق HTML scraping بگیریم
  const url = `https://t.me/s/${CHANNEL}`
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(15000),
  })
  if (!r.ok) throw new Error('scrape failed: ' + r.status)
  const html = await r.text()

  // استخراج پست‌ها از HTML
  // هر پست: <div class="tgme_widget_message" data-post="promptsfa1/1234">
  const postRegex = /data-post="([^"]+)"[\s\S]*?<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g
  const results: any[] = []
  let match
  while ((match = postRegex.exec(html)) !== null && results.length < count * 3) {
    const postPath = match[1]
    const text = match[2]
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .trim()

    const idMatch = postPath.match(/\/(\d+)$/)
    if (!idMatch) continue
    const msgId = parseInt(idMatch[1])

    // استخراج image از style background
    const imgRegex = new RegExp(`data-post="${postPath.replace('/', '\\/')}\\/[\\s\\S]*?background-image:url\\('([^']+)'\\)`)
    // راه ساده‌تر: از post单独
    results.push({ msgId, text, postPath })
  }

  return results
    .filter(p => p.msgId >= fromId)
    .sort((a, b) => a.msgId - b.msgId)
    .slice(0, count)
}

// scrape یک پست تکی با عکس
async function scrapeSingle(msgId: number): Promise<{ text: string; imgUrl: string | null } | null> {
  const url = `https://t.me/s/${CHANNEL}/${msgId}`
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(10000),
  })
  if (!r.ok) return null
  const html = await r.text()

  const textMatch = html.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)
  const imgMatch = html.match(/background-image:url\('([^']+)'\)/)

  if (!textMatch) return null

  const text = textMatch[1]
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim()

  return { text, imgUrl: imgMatch ? imgMatch[1] : null }
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const q = new URL(req.url).searchParams
  const count = Math.min(3, parseInt(q.get('count') || '2', 10))

  const cursor = parseInt(await getSetting('scrape_cursor', '689'), 10)
  const categories = await prisma.category.findMany({ include: { subs: true } })

  const results: any[] = []
  let imported = 0
  let scanned = 0

  // از cursor به جلو اسکن کن
  for (let msgId = cursor; imported < count && scanned < 50; msgId++, scanned++) {
    const slug = 'tg-' + msgId
    const start = Date.now()

    // skip اگر قبلاً ایمپورت شده
    if (await prisma.prompt.findUnique({ where: { slug } })) {
      await setSetting('scrape_cursor', String(msgId + 1))
      continue
    }

    const post = await scrapeSingle(msgId)
    if (!post) {
      // پست وجود ندارد یا private است — احتمالاً پایان کانال یا gap
      continue
    }

    if (post.text.length < 30) {
      await setSetting('scrape_cursor', String(msgId + 1))
      continue
    }

    try {
      const ai = await analyzeWithGemini({ text: post.text.slice(0, 1500), imgBase64: null, categories })
      const cat = categories.find((c) => c.slug === ai.categorySlug) ?? categories[0]
      const sub = ai.subSlug ? cat.subs.find((s) => s.slug === ai.subSlug) ?? null : null

      await prisma.prompt.create({
        data: {
          slug,
          titleFa: ai.titleFa,
          titleEn: ai.titleEn,
          descFa: ai.descFa,
          descEn: ai.descEn,
          usageFa: ai.usageFa,
          usageEn: ai.usageEn,
          img: post.imgUrl || DEFAULT_IMG,
          model: /--v\s?\d|--ar|midjourney/i.test(post.text) ? 'Midjourney' : 'AI',
          type: post.imgUrl ? 'IMAGE' : 'CODE',
          status: 'PENDING',
          categoryId: cat.id,
          subId: sub?.id ?? null,
          tagsFa: ai.tagsFa,
          tagsEn: ai.tagsEn,
          prompt: post.text,
          views: Math.floor(Math.random() * 50),
        },
      })

      imported++
      results.push({ msgId, cat: cat.slug, ms: Date.now() - start })
      await setSetting('scrape_cursor', String(msgId + 1))
    } catch (e: any) {
      results.push({ msgId, error: String(e?.message || e), ms: Date.now() - start })
    }
  }

  return NextResponse.json({
    ok: true,
    imported,
    scanned,
    nextCursor: cursor + scanned,
    results,
  })
}
