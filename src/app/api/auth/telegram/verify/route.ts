export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const TOKEN_TTL_MS = 10 * 60 * 1000

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token || token.length > 200) {
      return NextResponse.json({ ok: false, error: 'توکن نامعتبر است' }, { status: 400 })
    }

    const record = await prisma.loginToken.findUnique({
      where: { token },
      select: { status: true, createdAt: true },
    })

    if (!record || !record.status.startsWith('CONFIRMED:')) {
      return NextResponse.json({ ok: false, error: 'توکن تایید نشده یا نامعتبر است' }, { status: 401 })
    }

    const expired = Date.now() - new Date(record.createdAt).getTime() > TOKEN_TTL_MS
    if (expired) {
      await prisma.loginToken.deleteMany({ where: { token } }).catch(() => {})
      return NextResponse.json({ ok: false, error: 'توکن منقضی شده است' }, { status: 401 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'خطای سرور' }, { status: 500 })
  }
}