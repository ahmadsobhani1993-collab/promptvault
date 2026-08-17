import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeWithGemini } from '@/lib/gemini'
import { tgSendPhoto, tgSendCode } from '@/lib/telegram'
import { isCronAuthorized } from '@/lib/cron-auth'

export const maxDuration = 60

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'no id' }, { status: 400 })
  const p = await prisma.prompt.findUnique({ where: { id } })
  if (!p) return NextResponse.json({ error: 'not found' }, { status: 404 })

  let imgBase64: string | null = null
  try {
    const ir = await fetch(p.img, { signal: AbortSignal.timeout(15000), redirect: 'follow' })
    const buf = Buffer.from(await ir.arrayBuffer())
    if (ir.ok && buf.length > 5000 && buf.length < 2_500_000) imgBase64 = buf.toString('base64')
  } catch {}

  const categories = await prisma.category.findMany()
  let ai
  try { ai = await analyzeWithGemini({ text: p.prompt, imgBase64, categories }) }
  catch { ai = await analyzeWithGemini({ text: p.prompt, imgBase64: null, categories }) }

  const finalPrompt = (ai.promptEn || p.prompt).trim()
  await prisma.prompt.update({
    where: { id },
    data: {
      titleFa: ai.titleFa, titleEn: ai.titleEn,
      descFa: ai.descFa, descEn: ai.descEn,
      usageFa: ai.usageFa, usageEn: ai.usageEn,
      tagsFa: ai.tagsFa, tagsEn: ai.tagsEn,
      prompt: finalPrompt,
      status: 'PUBLISHED',
    },
  })

  const out = process.env.TELEGRAM_OUTPUT
  let tg: any = null
  if (out) {
    const tagLine = ai.tagsFa.map((t) => '#' + t.replace(/\s+/g, '_')).join(' ')
    const usageFa = (ai.usageFa || '').trim()
    const full = '✨ ' + ai.titleFa + '\n\n📘 ' + usageFa + '\n\n📝 ' + finalPrompt + '\n\n' + tagLine + '\n\n@Prompts_fa'
    const short = '✨ ' + ai.titleFa + '\n\n📘 ' + usageFa + '\n\n' + tagLine + '\n\n@Prompts_fa'
    if (full.length <= 1024) tg = await tgSendPhoto(out, p.img, full)
    else {
      tg = await tgSendPhoto(out, p.img, short)
      await tgSendCode(out, finalPrompt, '\n\n@Prompts_fa')
    }
  }

  return NextResponse.json({ ok: true, slug: p.slug, tg })
}
