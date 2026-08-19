import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const batch = await req.json()
    if (!Array.isArray(batch) || batch.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 })
    }

    // Insert all at once
    const data = batch.map((item: any) => ({
      path: String(item.path ?? '/').slice(0, 300),
      referrer: String(item.referrer ?? '').slice(0, 500) || null,
      ua: '',
      ip: '',
    }))

    await prisma.pageView.createMany({ data })
    return NextResponse.json({ ok: true, inserted: data.length })
  } catch (err) {
    console.error('Batch track error:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
