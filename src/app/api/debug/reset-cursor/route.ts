import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Reset import cursor in settings
  await prisma.setting.upsert({
    where: { key: 'import_cursor' },
    update: { value: '0' },
    create: { key: 'import_cursor', value: '0' },
  })

  // Also reset chained flag
  await prisma.setting.upsert({
    where: { key: 'import_chained' },
    update: { value: 'false' },
    create: { key: 'import_chained', value: 'false' },
  })

  return NextResponse.json({
    ok: true,
    message: 'Import cursor reset to 0',
    timestamp: new Date().toISOString(),
  })
}
