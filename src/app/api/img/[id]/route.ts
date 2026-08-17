import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function tgFileUrl(fileId: string): Promise<string | null> {
  const token = process.env.TELEGRAM_READ_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  try {
    const r = await fetch('https://api.telegram.org/bot' + token + '/getFile?file_id=' + encodeURIComponent(fileId), { signal: AbortSignal.timeout(8000) })
    const j = await r.json()
    const path = j?.result?.file_path
    return path ? 'https://api.telegram.org/file/bot' + token + '/' + path : null
  } catch {
    return null
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const row = await prisma.promptImage.findUnique({ where: { promptId: id } })
  if (row?.type === 'tg') {
    const url = await tgFileUrl(row.data)
    if (url) return NextResponse.redirect(url, { headers: { 'Cache-Control': 'public, max-age=86400' } })
  } else if (row?.data) {
    return new Response(Buffer.from(row.data, 'base64'), {
      headers: { 'Content-Type': row.type ?? 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
    })
  }

  const up = await prisma.uploadImage.findUnique({ where: { id } })
  if (up) {
    const url = await tgFileUrl(up.fileId)
    if (url) return NextResponse.redirect(url, { headers: { 'Cache-Control': 'public, max-age=86400' } })
  }

  const p = await prisma.prompt.findUnique({ where: { id }, select: { imgData: true, imgType: true } })
  if (p?.imgData) {
    return new Response(Buffer.from(p.imgData, 'base64'), {
      headers: { 'Content-Type': p.imgType ?? 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
    })
  }

  return NextResponse.json({ error: 'not found' }, { status: 404 })
}
