import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startId = parseInt(searchParams.get('start') || '1')
  const endId = parseInt(searchParams.get('end') || '1900') // Last message is 1884

  // Reset cursor and stop
  await prisma.setting.upsert({
    where: { key: 'import_cursor' },
    update: { value: String(startId) },
    create: { key: 'import_cursor', value: String(startId) }
  })

  await prisma.setting.upsert({
    where: { key: 'import_stop' },
    update: { value: String(endId) },
    create: { key: 'import_stop', value: String(endId) }
  })

  // Get current total prompts
  const totalPrompts = await prisma.prompt.count()

  return NextResponse.json({
    ok: true,
    message: `Import range reset: ${startId} to ${endId}`,
    range: { start: startId, end: endId, totalMessages: endId - startId + 1 },
    currentTotalPrompts: totalPrompts,
    estimatedNetworkMB: ((endId - startId) * 0.002).toFixed(2), // ~2KB per message
    nextStep: `Now run: /api/import-loop?count=50 to start importing from message ${startId}`,
  })
}
