import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const [
    tgCursor,
    ghSha,
    tgCount,
    ghCount,
    pendingCount,
    publishedCount,
  ] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'import_cursor2' } }),
    prisma.setting.findUnique({ where: { key: 'github_last_sha' } }),
    prisma.prompt.count({ where: { slug: { startsWith: 'tg-' } } }),
    prisma.prompt.count({ where: { slug: { startsWith: 'gh-' } } }),
    prisma.prompt.count({ where: { status: 'PENDING' } }),
    prisma.prompt.count({ where: { status: 'PUBLISHED' } }),
  ])

  return NextResponse.json({
    ok: true,
    telegram: {
      next_msg_id: tgCursor?.value ?? '2',
      imported_count: tgCount,
      note: 'از msgId=2 شروع شد — هر پست با slug tg-{id} ذخیره می‌شود',
    },
    github: {
      last_sha: ghSha?.value ?? '(none)',
      imported_count: ghCount,
    },
    totals: {
      pending: pendingCount,
      published: publishedCount,
      total: tgCount + ghCount,
    },
    duplicate_protection: 'هر پست قبل از create، با slug منحصربه‌فرد چک می‌شود → تکراری ممکن نیست',
  })
}
