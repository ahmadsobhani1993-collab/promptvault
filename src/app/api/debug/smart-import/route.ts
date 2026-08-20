import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startId = parseInt(searchParams.get('start') || '3660')
  const endId = parseInt(searchParams.get('end') || '10000')
  const batchSize = parseInt(searchParams.get('batch') || '100')

  // Get existing prompt IDs
  const existingPrompts = await prisma.prompt.findMany({
    where: { slug: { startsWith: 'tg-' } },
    select: { slug: true },
  })

  const importedIds = new Set(
    existingPrompts.map(p => {
      const idStr = p.slug.replace('tg-', '')
      const id = parseInt(idStr)
      return isNaN(id) ? null : id
    }).filter(Boolean) as number[]
  )

  // Find missing IDs
  const missingIds: number[] = []
  for (let i = startId; i <= endId && missingIds.length < batchSize; i++) {
    if (!importedIds.has(i)) {
      missingIds.push(i)
    }
  }

  // Update cursor to first missing ID
  if (missingIds.length > 0) {
    await prisma.setting.upsert({
      where: { key: 'import_cursor' },
      update: { value: String(missingIds[0]) },
      create: { key: 'import_cursor', value: String(missingIds[0]) }
    })

    await prisma.setting.upsert({
      where: { key: 'import_stop' },
      update: { value: String(endId + 1) },
      create: { key: 'import_stop', value: String(endId + 1) }
    })
  }

  return NextResponse.json({
    ok: true,
    missingIds,
    count: missingIds.length,
    cursor: missingIds.length > 0 ? missingIds[0] : null,
    message: missingIds.length > 0
      ? `${missingIds.length} پرامپت جدید پیدا شد. import-loop را اجرا کنید.`
      : 'همه پرامپت‌ها در این بازه ایمپورت شده‌اند',
    importUrl: missingIds.length > 0
      ? `https://promptsfa.ir/api/import-loop?key=pv-cron-8x2m1q&count=${missingIds.length}`
      : null,
  })
}
