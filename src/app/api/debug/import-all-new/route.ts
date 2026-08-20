import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startCursor = parseInt(searchParams.get('start') || '506')
  const stopCursor = parseInt(searchParams.get('stop') || '1885')

  // Update cursor and stop
  await prisma.setting.upsert({
    where: { key: 'import_cursor' },
    update: { value: String(startCursor) },
    create: { key: 'import_cursor', value: String(startCursor) }
  })

  await prisma.setting.upsert({
    where: { key: 'import_stop' },
    update: { value: String(stopCursor) },
    create: { key: 'import_stop', value: String(stopCursor) }
  })

  const totalPromptsBefore = await prisma.prompt.count()

  return NextResponse.json({
    ok: true,
    message: `Import range set: ${startCursor} to ${stopCursor}`,
    totalPromptsBefore,
    nextStep: `Now run: /api/import-loop?key=pv-cron-8x2m1q&count=100`,
    estimatedNetworkMB: ((stopCursor - startCursor) * 0.002).toFixed(2),
  })
}
