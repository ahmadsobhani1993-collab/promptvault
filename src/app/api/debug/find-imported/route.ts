import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const startId = parseInt(searchParams.get('start') || '3660')
  const endId = parseInt(searchParams.get('end') || '5000')

  // Get all prompts with tg- slug
  const existingPrompts = await prisma.prompt.findMany({
    where: {
      slug: {
        startsWith: 'tg-'
      }
    },
    select: {
      slug: true,
      createdAt: true,
      titleFa: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // Extract message IDs from slugs
  const importedIds = existingPrompts.map(p => {
    const idStr = p.slug.replace('tg-', '')
    const id = parseInt(idStr)
    return isNaN(id) ? null : id
  }).filter(Boolean) as number[]

  // Find which IDs in range are missing
  const missingIds: number[] = []
  for (let i = startId; i <= endId; i++) {
    if (!importedIds.includes(i)) {
      missingIds.push(i)
    }
  }

  return NextResponse.json({
    ok: true,
    range: { start: startId, end: endId },
    totalInDatabase: existingPrompts.length,
    importedInRange: importedIds.filter(id => id >= startId && id <= endId).length,
    missingInRange: missingIds.length,
    importedIds: importedIds.slice(0, 50), // First 50
    missingIds: missingIds.slice(0, 50), // First 50
    hint: `از ${startId} تا ${endId}: ${missingIds.length} پرامپت ایمپورت نشده`,
    nextStep: `برای ایمپورت این‌ها، import-loop را اجرا کنید. آن‌ها به‌طور خودکار skip می‌شوند.`,
  })
}
