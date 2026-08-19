import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const cursor = (await prisma.setting.findUnique({ where: { key: 'import_cursor' } }))?.value || '0'
  const stop = (await prisma.setting.findUnique({ where: { key: 'import_stop' } }))?.value || '3660'
  const totalPrompts = await prisma.prompt.count()

  return NextResponse.json({
    ok: true,
    importCursor: parseInt(cursor),
    importStop: parseInt(stop),
    totalPrompts,
    isRunning: parseInt(cursor) < parseInt(stop),
    message: parseInt(cursor) < parseInt(stop) 
      ? 'Import still running (cursor < stop)' 
      : 'Import stopped or completed',
  })
}
