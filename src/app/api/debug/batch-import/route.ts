import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isCronAuthorized } from '@/lib/cron-auth'

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const count = parseInt(searchParams.get('count') || '100')

  const currentCursor = parseInt((await prisma.setting.findUnique({ where: { key: 'import_cursor' } }))?.value || '0')
  const stop = parseInt((await prisma.setting.findUnique({ where: { key: 'import_stop' } }))?.value || '10000')
  const totalBefore = await prisma.prompt.count()

  if (currentCursor >= stop) {
    return NextResponse.json({
      ok: true,
      message: 'Import already completed',
      cursor: currentCursor,
      stop,
    })
  }

  return NextResponse.json({
    ok: true,
    message: `برای ایمپورت ${count} پرامپت جدید، این لینک را بزنید:`,
    importUrl: `https://promptsfa.ir/api/import-loop?key=pv-cron-8x2m1q&count=${count}`,
    statusBefore: {
      cursor: currentCursor,
      stop,
      totalPrompts: totalBefore,
    },
    hint: 'بعد از اجرا، import-status را چک کنید تا پیشرفت را ببینید',
  })
}
