import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const p = await prisma.prompt.findUnique({ where: { id }, select: { imgData: true, imgType: true } })
  if (!p?.imgData) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return new Response(Buffer.from(p.imgData, 'base64'), {
    headers: {
      'Content-Type': p.imgType ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
