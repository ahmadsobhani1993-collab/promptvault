import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { tgSendPhoto, tgSendText } from '@/lib/telegram'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const out = process.env.TELEGRAM_OUTPUT
  if (!out) return NextResponse.json({ error: 'TELEGRAM_OUTPUT not set' }, { status: 500 })

  const text = await tgSendText(out, '✅ تست ارسال PromptsFA — ' + new Date().toLocaleString('fa-IR'))

  const p = await prisma.prompt.findFirst({ where: { status: 'PUBLISHED' }, orderBy: { createdAt: 'desc' }, select: { img: true, titleFa: true } })
  const photo = p ? await tgSendPhoto(out, p.img, '📷 ' + p.titleFa + '\n\n🔗 @Prompts_fa') : { error: 'no prompt' }

  return NextResponse.json({ output: out, textResult: text, photoResult: photo })
}
