import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const q = new URL(req.url).searchParams
  const targetId = q.get('id') || '691'

  await prisma.setting.upsert({
    where: { key: 'import_cursor2' },
    update: { value: targetId },
    create: { key: 'import_cursor2', value: targetId },
  })

  return NextResponse.json({
    ok: true,
    message: `Import cursor reset to ${targetId}`,
    import_cursor2: targetId,
    timestamp: new Date().toISOString(),
  })
}
