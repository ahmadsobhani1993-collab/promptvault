export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ ok: false, error: 'توکن نامعتبر است' }, { status: 400 })
    }

    const record = await prisma.loginToken.findUnique({
      where: { token },
    })

    if (!record || !record.status.startsWith('CONFIRMED:')) {
      return NextResponse.json({ ok: false, error: 'توکن تایید نشده یا نامعتبر است' }, { status: 401 })
    }

    const isExpired = Date.now() - new Date(record.createdAt).getTime() > 10 * 60 * 1000
    if (isExpired) {
      await prisma.loginToken.delete({ where: { token } }).catch(() => {})
      return NextResponse.json({ ok: false, error: 'توکن منقضی شده است' }, { status: 401 })
    }

    const userId = record.status.replace('CONFIRMED:', '')
    return NextResponse.json({ ok: true, userId })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 })
  }
}
