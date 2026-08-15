import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const envs = {
    AUTH_SECRET: !!process.env.AUTH_SECRET ? 'set (' + process.env.AUTH_SECRET!.length + ' chars)' : 'MISSING',
    AUTH_URL: process.env.AUTH_URL || 'MISSING',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'MISSING',
    AUTH_GOOGLE_ID: !!process.env.AUTH_GOOGLE_ID ? 'set (ends: ...' + process.env.AUTH_GOOGLE_ID!.slice(-10) + ')' : 'MISSING',
    AUTH_GOOGLE_SECRET: !!process.env.AUTH_GOOGLE_SECRET ? 'set (' + process.env.AUTH_GOOGLE_SECRET!.length + ' chars)' : 'MISSING',
    DATABASE_URL: !!process.env.DATABASE_URL ? 'set' : 'MISSING',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'MISSING',
  }

  let dbStatus: string
  try {
    await prisma.$queryRaw`SELECT 1`
    dbStatus = 'OK'
  } catch (e: any) {
    dbStatus = 'ERROR: ' + (e?.message ?? String(e))
  }

  let userCount: number | string
  try {
    userCount = await prisma.user.count()
  } catch (e: any) {
    userCount = 'ERROR: ' + (e?.message ?? String(e))
  }

  return NextResponse.json({
    envs,
    db: dbStatus,
    userCount,
    time: new Date().toISOString(),
  })
}
